import JSZip from "jszip";

// Types for EPUB structure
interface EPUBMetadata {
	title: string;
	subtitle?: string;
	fullTitle: string;
	creator?: string;
	language: string;
	identifier: string;
}

/**
 * Represents a navigation point in the EPUB.
 *
 * The navigation point can contain children, which represent sub-sections of the parent.
 * For example, Chapter 2 -> Section 2.1 -> Subsection 2.1.1
 */
interface NavPoint {
	id: string;
	label: string;
	src: string;
	order: number;
	children: Array<NavPoint>;
}

interface ManifestItem {
	id: string;
	path: string;
	mediaType: string;
	properties?: Array<string>;
}

interface EPUBStructure {
	metadata: EPUBMetadata;
	navigation: Array<NavPoint>;
	spine: Array<string>; // Ordered list of content file paths
	manifest: Record<string, ManifestItem>; // id -> path mapping
	contentFolder: string;
}

/**
 * EPUB Parser for EPUB 3 files.
 */
export class EPUBParser {
	private zip: JSZip;
	private structure: EPUBStructure;
	private readonly contentCache: Map<string, string>;

	private constructor() {
		this.zip = null!;
		this.structure = null!;
		this.contentCache = new Map<string, string>();
	}

	private parseManifest(opfDocument: Document): Record<string, ManifestItem> {
		const manifestElement = opfDocument.querySelector("manifest");
		if (!manifestElement) throw new Error("No manifest found in OPF");

		const manifestChildren = Array.from(manifestElement.children);

		return Object.fromEntries(
			manifestChildren.map((child) => {
				const id = child.getAttribute("id") || "";
				const path = child.getAttribute("href") || "";
				const mediaType = child.getAttribute("media-type") || "";
				const propertiesAttribute = child.getAttribute("properties");
				const properties = propertiesAttribute
					? propertiesAttribute.split(" ")
					: [];

				return [id, { id, path, mediaType, properties }];
			})
		);
	}

	/**
	 * Parses the spine of the EPUB.
	 * The spine is a `<spine>` element with `<itemref>` children, each of which contains a
	 * `idref` attribute that points to an item in the manifest.
	 *
	 * @example
	 * <spine>
	 *   <itemref idref="chapter1"/>
	 *   <itemref idref="chapter2"/>
	 * </spine>
	 *
	 * @param opfDocument - The OPF document.
	 * @returns An array of file paths in the spine.
	 */
	private parseSpine(opfDocument: Document): Array<string> {
		const spineElement = opfDocument.querySelector("spine");
		if (!spineElement) throw new Error("No spine found in OPF");

		// TODO: check if linear property matters?
		const itemRefs = spineElement.querySelectorAll("itemref");
		return Array.from(itemRefs)
			.map((itemRef) => itemRef.getAttribute("idref"))
			.filter(Boolean);
	}

	private async parseNavigation(
		contentFolder: string
	): Promise<Array<NavPoint>> {
		// TODO check if it's always called nav or we have to dynamically find the name in another way
		const navigationFilePath = `${contentFolder}/nav.xhtml`;
		const navigationContent = await this.zip
			.file(navigationFilePath)
			?.async("text");

		if (!navigationContent) {
			throw new Error(`Cannot read navigation file: ${navigationFilePath}`);
		}

		const domParser = new DOMParser();
		const navigationDocument = domParser.parseFromString(
			navigationContent,
			"text/xml"
		);

		const navElement = navigationDocument.querySelector(
			'nav[epub\\:type="toc"]'
		);
		if (!navElement) {
			throw new Error("No navigation element found in nav.xhtml");
		}

		const olElement = navElement.querySelector("ol");

		return this.parseNavElement(olElement, 1);
	}

	/**
	 * Parses a navigation element (ol) and returns an array of NavPoint objects.
	 * A navigation element can contain <li> children, each of which either contains a
	 * leaf node, i.e. <a> element, or a subtree of navigation elements (i.e. another <ol>).
	 *
	 * @param olElement - The ol element to parse.
	 * @param depth - The depth of the current navigation element.
	 * @returns An array of NavPoint objects.
	 */
	private parseNavElement(
		olElement: Element | null,
		depth: number
	): Array<NavPoint> {
		if (!olElement) return [];

		const listElementChildren = Array.from(olElement.children);

		let order = 0;
		const navigationPoints: Array<NavPoint> = listElementChildren.flatMap(
			(listElement) => {
				const link = listElement.querySelector("a");
				if (!link) return [];

				order++;
				const label = link.textContent?.trim() || "";
				const source = link.getAttribute("href") || "";
				const id = `nav-${depth}-${order}`;

				const subOlElement = listElement.querySelector("ol");
				const childrenNavPoints = this.parseNavElement(subOlElement, depth + 1);

				return [
					{
						id,
						label,
						src: source,
						order,
						children: childrenNavPoints,
					},
				];
			}
		);

		return navigationPoints;
	}

	private parseMetadata(opfDocument: Document): EPUBMetadata {
		const metadataElement = opfDocument.querySelector("metadata");
		if (!metadataElement) throw new Error("No metadata found in OPF");

		// Helper function for getting DC metadata
		const getDC = (name: string): string => {
			return (
				metadataElement.querySelector(`dc\\:${name}, *|${name}`)?.textContent ||
				""
			);
		};

		// Get all title elements
		const titleElements = metadataElement.querySelectorAll(
			"dc\\:title, *|title"
		);

		if (titleElements.length === 0) {
			throw new Error("No title elements found in metadata");
		}

		let mainTitle = "";
		let subtitle = "";

		// Process each title element
		/**
		 * Example title elements
		 * 		<dc:title id="t1">Children's Literature</dc:title>
		 * 		<meta refines="#t1" property="title-type">main</meta>
		 * 		<meta refines="#t1" property="display-seq">1</meta>
		 *
		 * 		<dc:title id="t2">A Textbook of Sources for Teachers and Teacher-Training Classes</dc:title>
		 * 		<meta refines="#t2" property="title-type">subtitle</meta>
		 * 		<meta refines="#t2" property="display-seq">2</meta>
		 */
		titleElements.forEach((titleElement) => {
			const id = titleElement.getAttribute("id");
			const titleText = titleElement.textContent || "";
			if (!id) return;

			// Look for title-type refinement
			const titleType = metadataElement.querySelector(
				`meta[refines="#${id}"][property="title-type"]`
			)?.textContent;

			if (titleType === "main") {
				mainTitle = titleText;
			} else if (titleType === "subtitle") {
				subtitle = titleText;
			}
		});

		// If no refined titles found, use first title as main and second (if exists) as subtitle
		if (!mainTitle && titleElements.length > 0) {
			mainTitle = titleElements[0]!.textContent || "";
			if (titleElements.length > 1) {
				subtitle = titleElements[1]!.textContent || "";
			}
		}

		// Get other metadata
		const creators: Array<string> = [];
		const creatorElements = metadataElement.querySelectorAll(
			"dc\\:creator, *|creator"
		);

		/**
		 * Example creator elements
		 * 		<dc:creator id="curry">Charles Madison Curry</dc:creator>
		 * 		<meta property="file-as" refines="#curry">Curry, Charles Madison</meta>
		 */
		creatorElements.forEach((element) => {
			const creatorId = element.getAttribute("id");
			let creatorName = element.textContent || "";

			if (creatorId) {
				const fileAs = metadataElement.querySelector(
					`meta[refines="#${creatorId}"][property="file-as"]`
				);
				if (fileAs) {
					creatorName = fileAs.textContent || creatorName;
				}
			}

			creators.push(creatorName);
		});

		return {
			title: mainTitle,
			subtitle: subtitle || undefined, // Only include if exists
			fullTitle: subtitle ? `${mainTitle}: ${subtitle}` : mainTitle,
			creator: creators.join("; "),
			language: getDC("language"),
			identifier: getDC("identifier"),
		};
	}

	public async loadEPUB(epubArrayBuffer: ArrayBuffer): Promise<EPUBStructure> {
		this.zip = await JSZip.loadAsync(epubArrayBuffer);
		this.structure = await this.parseContainer();
		return this.structure;
	}

	public static async createParser(
		epubArrayBuffer: ArrayBuffer
	): Promise<EPUBParser> {
		const parser = new EPUBParser();
		await parser.loadEPUB(epubArrayBuffer);
		return parser;
	}

	private async parseContainer(): Promise<EPUBStructure> {
		// First, find and parse container.xml to get the OPF file path
		const containerXml = await this.zip
			.file("META-INF/container.xml")
			?.async("text");
		if (!containerXml) throw new Error("Invalid EPUB: Missing container.xml");

		const domParser = new DOMParser();
		const container = domParser.parseFromString(containerXml, "text/xml");

		// Example of rootffile: <rootfile media-type="application/oebps-package+xml" full-path="EPUB/package.opf"/>
		const opfPath = container
			.querySelector("rootfile")
			?.getAttribute("full-path");
		if (!opfPath)
			throw new Error(
				"Invalid EPUB: Cannot find OPF file path from container.xml"
			);

		// Parse the OPF file
		const opfContent = await this.zip.file(opfPath)?.async("text");
		if (!opfContent) throw new Error("Invalid EPUB: Cannot read OPF file");

		const opfDocument = domParser.parseFromString(opfContent, "text/xml");

		// Get the content folder path (everything before the last slash in OPF path)
		// Usually EPUB/
		const contentFolder = opfPath.substring(0, opfPath.lastIndexOf("/"));

		return {
			metadata: this.parseMetadata(opfDocument),
			navigation: await this.parseNavigation(contentFolder),
			spine: this.parseSpine(opfDocument),
			manifest: this.parseManifest(opfDocument),
			contentFolder,
		};
	}

	public getMetadata(): EPUBMetadata {
		return this.structure.metadata;
	}

	public getNavigation(): Array<NavPoint> {
		return this.structure.navigation;
	}

	public getSpine(): Array<string> {
		return this.structure.spine;
	}

	public getManifest(): Record<string, ManifestItem> {
		return this.structure.manifest;
	}

	// async getChapterContent(chapterId: string): Promise<string> {
	// 	// Check cache first
	// 	if (this.contentCache.has(chapterId)) {
	// 		return this.contentCache.get(chapterId)!;
	// 	}

	// 	// Get file path from manifest
	// 	const filePath = this.structure.manifest.get(chapterId);
	// 	if (!filePath)
	// 		throw new Error(`Chapter ${chapterId} not found in manifest`);

	// 	// Load and cache content
	// 	const fullPath = `${this.structure.contentFolder}/${filePath}`;
	// 	const content = await this.zip.file(fullPath)?.async("text");
	// 	if (!content) throw new Error(`Cannot read chapter file: ${fullPath}`);

	// 	// Cache the content (optional - depends on memory constraints)
	// 	this.contentCache.set(chapterId, content);

	// 	return content;
	// }

	// clearCache() {
	// 	this.contentCache.clear();
	// }

	// // Helper method to free memory when done with the EPUB
	// dispose() {
	// 	this.clearCache();
	// 	this.zip = null!;
	// 	this.structure = null!;
	// }

	// Implementation details for parseMetadata, parseNavigation, parseSpine, etc. would go here
}

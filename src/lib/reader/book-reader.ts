import type { EPUBParser } from "@/lib/epub/parser";
import { HTMLToBlocksParser } from "@/lib/view/html2block";
import { Paginator, type Page } from "@/lib/view/pagination";

interface BookReaderOptions {
	width: number;
	height: number;
	fontSize: number;
	lineHeight: number;
}

export class BookReader {
	private readonly parser: EPUBParser;
	private readonly paginator: Paginator;
	private readonly blockParser: HTMLToBlocksParser;
	private readonly chapterCache: Map<string, Array<Page>>;

	public constructor(parser: EPUBParser, options: BookReaderOptions) {
		this.parser = parser;
		this.paginator = new Paginator(
			{
				width: options.width,
				height: options.height,
			},
			{
				fontSize: options.fontSize,
				lineHeight: options.lineHeight,
			}
		);
		this.blockParser = new HTMLToBlocksParser();
		this.chapterCache = new Map<string, Array<Page>>();
	}

	public async getChapterPages(chapterId: string): Promise<Array<Page>> {
		// Check cache first
		const cachedPages = this.chapterCache.get(chapterId);
		if (cachedPages) {
			return cachedPages;
		}

		// Get chapter content and convert to pages
		const chapterContent = await this.parser.getChapterContent(chapterId);
		const blocks = this.blockParser.parse(chapterContent);
		const pages = this.paginator.calculatePages(blocks);

		// Cache the result
		this.chapterCache.set(chapterId, pages);
		return pages;
	}

	public clearCache(): void {
		this.chapterCache.clear();
	}

	// Convenience methods to access parser data
	public getMetadata(): ReturnType<EPUBParser["getMetadata"]> {
		return this.parser.getMetadata();
	}

	public getNavigation(): ReturnType<EPUBParser["getNavigation"]> {
		return this.parser.getNavigation();
	}

	public getManifest(): ReturnType<EPUBParser["getManifest"]> {
		return this.parser.getManifest();
	}

	// Optional: Preload methods
	public async preloadChapter(chapterId: string): Promise<void> {
		await this.getChapterPages(chapterId);
	}

	public async preloadAdjacentChapters(
		currentChapterId: string
	): Promise<void> {
		const spine = this.parser.getSpine();
		const currentIndex = spine.indexOf(currentChapterId);

		const preloadPromises: Array<Promise<void>> = [];

		// Preload next chapter
		if (currentIndex < spine.length - 1) {
			preloadPromises.push(this.preloadChapter(spine[currentIndex + 1]!));
		}

		// Preload previous chapter
		if (currentIndex > 0) {
			preloadPromises.push(this.preloadChapter(spine[currentIndex - 1]!));
		}

		await Promise.all(preloadPromises);
	}

	public async navigateToId(epubId: string): Promise<{
		pages: Array<Page>;
		pageIndex: number;
	}> {
		const [fileName, id] = epubId.split("#");
		const manifestValues = Object.values(this.getManifest());
		const manifestItem = manifestValues.find((item) => item.path === fileName);

		if (!manifestItem) {
			return { pages: [], pageIndex: -1 };
		}

		const chapterPages = await this.getChapterPages(manifestItem.id);

		if (!id) {
            // Return the first page if there is no suffix ID
			return { pages: chapterPages, pageIndex: 0 };
		}

		const pageIndex = chapterPages.findIndex((page) =>
			page.checkIfPageContainsId(id)
		);

		if (pageIndex === -1) {
			return { pages: chapterPages, pageIndex: 0 };
		}

		return { pages: chapterPages, pageIndex };
	}
}

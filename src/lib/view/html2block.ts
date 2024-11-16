import type { ChapterContent } from "@/lib/epub/parser";
import type {
	ContentBlock,
	HeadingBlock,
	ImageBlock,
	RichTextBlock,
	RichTextSegment,
} from "@/lib/view/pagination";

/**
 * Converts a Block element (like <p>, <div>, <h1>, etc.) to a rich text block.
 * A rich text block handles different kinds of styles (bold, italic, underline)
 * and is used to represent text in a page.
 */
class HTMLToRichTextConverter {
	public convert(html: string): Array<RichTextBlock> {
		const parser = new DOMParser();
		const document_ = parser.parseFromString(html, "text/html");
		return this.processNodes(document_.body);
	}

	// Note in our approach, if we have nested block elements
	// The nesting is no longer preserved.
	public processNodes(parent: HTMLElement): Array<RichTextBlock> {
		const blocks: Array<RichTextBlock> = [];
		let currentBlock: RichTextBlock = this.createEmptyBlock(parent.tagName);

		for (const node of Array.from(parent.childNodes)) {
			if (node.nodeType === Node.TEXT_NODE) {
				if (!node.textContent?.trim()) {
					continue;
				}

				currentBlock.segments.push({
					text: node.textContent,
					style: this.getParentStyle(node),
				});
			} else if (node instanceof HTMLElement) {
				if (this.isBlockElement(node)) {
					if (currentBlock.segments.length) blocks.push(currentBlock);
					blocks.push(...this.processNodes(node));
					currentBlock = this.createEmptyBlock(parent.tagName);
				} else {
					currentBlock.segments.push({
						text: node.textContent || "",
						style: this.getElementStyle(node),
					});
				}
			}
		}

		if (currentBlock.segments.length) blocks.push(currentBlock);
		return blocks;
	}

	private getElementStyle(element: HTMLElement): RichTextSegment["style"] {
		return {
			bold: element.tagName === "STRONG" || element.tagName === "B",
			italic: element.tagName === "EM" || element.tagName === "I",
			underline: element.tagName === "U",
		};
	}

	private getParentStyle(node: Node): RichTextSegment["style"] {
		const parent = node.parentElement;
		return {
			bold: parent?.closest("strong,b") !== null,
			italic: parent?.closest("em,i") !== null,
			underline: parent?.closest("u") !== null,
		};
	}

	private isBlockElement(element: HTMLElement): boolean {
		return ["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6"].includes(
			element.tagName
		);
	}

	private createEmptyBlock(tag: string): RichTextBlock {
		return {
			type: "richtext",
			segments: [],
			metadata: { tag: tag.toLowerCase() },
		};
	}
}

function createImageUrl(imageData: ArrayBuffer | Uint8Array): string {
	const blob = new Blob([imageData], { type: "image/jpeg" });
	return URL.createObjectURL(blob);
}

export class HTMLToBlocksParser {
	private currentBlock: RichTextBlock | null = null;
	private blocks: Array<ContentBlock> = [];
	private readonly richTextConverter = new HTMLToRichTextConverter();
	private imageSourceToURL: Record<string, string> = {};

	public parse(chapterContent: ChapterContent): Array<ContentBlock> {
		const { html, images } = chapterContent;
		const imageSourceToURL = Object.fromEntries(
			images.map((image) => [image.src, createImageUrl(image.data)])
		);
		this.imageSourceToURL = imageSourceToURL;

		this.blocks = [];
		const parser = new DOMParser();
		const document_ = parser.parseFromString(html, "text/html");

		this.processNode(document_.body);
		this.flushCurrentBlock(); // Ensure any remaining text is added
		return this.blocks;
	}

	private processNode(node: Node | undefined): void {
		if (!node) return;

		if (node.nodeType !== Node.ELEMENT_NODE) return;

		const element = node as Element;

		switch (element.tagName.toLowerCase()) {
			case "h1":
			case "h2":
			case "h3":
			case "h4":
			case "h5":
			case "h6":
				this.flushCurrentBlock();
				this.handleHeading(element);
				break;

			case "img":
				this.flushCurrentBlock();
				this.handleImage(element as HTMLImageElement);
				break;

			case "p":
			case "div":
			case "span":
				// Convert the element and its children to rich text blocks
				// eslint-disable-next-line no-case-declarations
				const richTextBlocks = this.richTextConverter.processNodes(
					element as HTMLElement
				);
				this.flushCurrentBlock();
				this.blocks.push(...richTextBlocks);
				break;

			default:
				// Process children for unknown elements
				for (let index = 0; index < element.childNodes.length; index++) {
					this.processNode(element.childNodes[index]);
				}
		}
	}

	private handleHeading(element: Element): void {
		if (element.tagName.length !== 2) {
			throw new Error("SHOULD NEVER HAPPEN: Invalid heading tag name");
		}

		const level = parseInt(element.tagName[1]!);
		const headingBlock = {
			type: "heading",
			content: element.textContent?.trim() || "",
			metadata: {
				level,
			},
		} satisfies HeadingBlock;

		this.blocks.push(headingBlock);
	}

	private handleImage(element: HTMLImageElement): void {
		const width = parseInt(element.getAttribute("width") || "0");
		const height = parseInt(element.getAttribute("height") || "0");
		// Don't access .src here as it resolves the relative URL
		const source = element.getAttribute("src");
		if (!source) {
			throw new Error("SHOULD NEVER HAPPEN: Image source not found");
		}

		const imageURL = this.imageSourceToURL[source];
		if (!imageURL) {
			throw new Error(
				`SHOULD NEVER HAPPEN: Image URL not found for source: ${source}`
			);
		}

		const imageBlock = {
			type: "image",
			src: imageURL,
			metadata: {
				dimensions: {
					width: width || 300, // Default width if not specified
					height: height || 200, // Default height if not specified
				},
				alt: element.getAttribute("alt") || undefined,
			},
		} satisfies ImageBlock;

		console.log(`Creating image block: ${JSON.stringify(imageBlock, null, 2)}`);

		this.blocks.push(imageBlock);
	}

	/**
	 * Flushes the current block if it has segments.
	 * Used to reset the current block after a block element is processed.
	 */
	private flushCurrentBlock(): void {
		if (!this.currentBlock) return;
		if (this.currentBlock.segments.length === 0) return;

		this.blocks.push(this.currentBlock);
		this.currentBlock = null;
	}
}

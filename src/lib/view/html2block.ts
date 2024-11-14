import type {
	ContentBlock,
	HeadingBlock,
	ImageBlock,
	TextBlock,
} from "@/lib/view/pagination";

export class HTMLToBlocksParser {
	private currentTextContent: string = "";
	private currentTag: string = "p";
	private blocks: Array<ContentBlock> = [];

	public parse(html: string): Array<ContentBlock> {
		this.blocks = [];
		const parser = new DOMParser();
		const document_ = parser.parseFromString(html, "text/html");

		this.processNode(document_.body);
		this.flushTextBlock(); // Ensure any remaining text is added
		return this.blocks;
	}

	private processNode(node: Node | undefined): void {
		if (!node) return;

		// Handle text nodes
		if (node.nodeType === Node.TEXT_NODE) {
			// Text node
			this.currentTextContent += node.textContent?.trim() + " ";
			return;
		}

		// Handle element nodes
		if (node.nodeType === Node.ELEMENT_NODE) {
			// Element node
			const element = node as Element;

			// Flush any existing text before handling block elements
			if (this.isBlockElement(element.tagName)) {
				this.flushTextBlock();
			}

			switch (element.tagName.toLowerCase()) {
				case "h1":
				case "h2":
				case "h3":
				case "h4":
				case "h5":
				case "h6":
					this.handleHeading(element);
					break;

				case "img":
					this.handleImage(element);
					break;

				case "p":
				case "div":
				case "span":
					// Update current tag for text blocks
					this.currentTag = element.tagName.toLowerCase();
					// Process children
					for (let index = 0; index < element.childNodes.length; index++) {
						this.processNode(element.childNodes[index]);
					}
					break;

				default:
					// Process children for unknown elements
					for (let index = 0; index < element.childNodes.length; index++) {
						this.processNode(element.childNodes[index]);
					}
			}
		}

		this.flushTextBlock();
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

	private handleImage(element: Element): void {
		const width = parseInt(element.getAttribute("width") || "0");
		const height = parseInt(element.getAttribute("height") || "0");

		const imageBlock = {
			type: "image",
			// TODO how to handle the image data?
			content: new ImageData(width, height),
			metadata: {
				dimensions: {
					width: width || 300, // Default width if not specified
					height: height || 200, // Default height if not specified
				},
				alt: element.getAttribute("alt") || undefined,
			},
		} satisfies ImageBlock;

		this.blocks.push(imageBlock);
	}

	private flushTextBlock(): void {
		if (this.currentTextContent.trim()) {
			const textBlock = {
				type: "text",
				content: this.currentTextContent.trim(),
				metadata: {
					tag: this.currentTag,
				},
			} satisfies TextBlock;
			this.blocks.push(textBlock);
			this.currentTextContent = "";
			this.currentTag = "p";
		}
	}

	private isBlockElement(tagName: string): boolean {
		const blockElements = ["div", "p", "h1", "h2", "h3", "h4", "h5", "h6"];
		return blockElements.includes(tagName.toLowerCase());
	}
}

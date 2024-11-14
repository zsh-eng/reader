import type {
	ContentBlock,
	HeadingBlock,
	ImageBlock,
	TextBlock,
} from "./pagination";

export class BlocksToHTMLConverter {
	public convert(blocks: Array<ContentBlock>): string {
		return blocks.map((block) => this.convertBlock(block)).join("\n");
	}

	private convertBlock(block: ContentBlock): string {
		switch (block.type) {
			case "heading":
				return this.convertHeading(block);
			case "image":
				return this.convertImage(block);
			case "text":
				return this.convertText(block);
			default:
				// Exhaustive type checking
				const _exhaustiveCheck: never = block;
				throw new Error(
					`Unknown block type: ${(_exhaustiveCheck as ContentBlock).type}`
				);
		}
	}

	private convertHeading(block: HeadingBlock): string {
		const { level } = block.metadata;
		const sanitizedContent = this.escapeHTML(block.content);
		return `<h${level}>${sanitizedContent}</h${level}>`;
	}

	private convertImage(block: ImageBlock): string {
		const { dimensions, alt } = block.metadata;
		const altAttribute = alt ? ` alt="${this.escapeHTML(alt)}"` : "";
		return `<img width="${dimensions.width}" height="${dimensions.height}"${altAttribute}>`;
	}

	private convertText(block: TextBlock): string {
		const { tag } = block.metadata;
		const sanitizedContent = this.escapeHTML(block.content);
		return `<${tag}>${sanitizedContent}</${tag}>`;
	}

	private escapeHTML(string_: string): string {
		const escapeMap: Record<string, string> = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#039;",
		};

		return string_.replace(/[&<>"']/g, (match) => escapeMap[match] ?? match);
	}
}

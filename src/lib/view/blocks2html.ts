import type {
	ContentBlock,
	HeadingBlock,
	ImageBlock,
	RichTextBlock,
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
			case "richtext":
				return this.convertRichText(block);
			default:
				// Exhaustive type checking
				// eslint-disable-next-line
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
		const source = block.src;
		return `<img width="${dimensions.width}" height="${dimensions.height}"${altAttribute} src="${source}" style="margin-left: auto; margin-right: auto;">`;
	}

	private convertRichText(block: RichTextBlock): string {
		const { tag } = block.metadata;

		const content = block.segments
			.map((segment) => {
				let text = segment.text;
				if (segment.style?.bold) text = `<strong>${text}</strong>`;
				if (segment.style?.italic) text = `<em>${text}</em>`;
				if (segment.style?.underline) text = `<u>${text}</u>`;
				return text;
			})
			.join(" ");
		const lastSegmentContinuesOnNextPage =
			block.segments.at(-1)?.metadata?.continuesOnNextPage;
		const lastSegmentContinuesOnNextPageAttribute = lastSegmentContinuesOnNextPage
			? 'style="text-align-last: justify;"'
			: "";

		return `<${tag} ${lastSegmentContinuesOnNextPageAttribute}>${content}</${tag}>`;
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

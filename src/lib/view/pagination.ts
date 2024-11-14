import { BlocksToHTMLConverter } from "@/lib/view/blocks2html";

export type TextBlock = {
	type: "text";
	content: string;
	metadata: {
		tag: string;
	};
};

export type ImageBlock = {
	type: "image";
	content: ImageData;
	metadata: {
		dimensions: { width: number; height: number };
		alt?: string;
	};
};

export type HeadingBlock = {
	type: "heading";
	content: string;
	metadata: {
		level: number;
	};
};

/**
 * Represents a block of content in a page.
 */
export type ContentBlock = TextBlock | ImageBlock | HeadingBlock;

type TextMetrics = {
	containerWidth: number;
	containerHeight: number;
	fontSize: number;
	lineHeight: number;
	charsPerLine: number;
	paragraphSpacing: number;
};

type WithOffset<T extends ContentBlock> = T & {
	blockOffset?: {
		start: number;
		end: number;
	};
};

type PageResult =
	| {
			type: "page-completed";
			remainingBlock: WithOffset<ContentBlock>;
	  }
	| {
			type: "page-has-space";
			remainingHeight: number;
	  };

/**
 * Encapsulates a page of content.
 */
export class Page {
	private readonly textMetrics: TextMetrics;
	private readonly blocks: Array<ContentBlock> = [];
	private remainingHeight: number = 0;

	public constructor(textMetrics: TextMetrics) {
		this.textMetrics = textMetrics;
		this.remainingHeight = textMetrics.containerHeight;
	}

	public tryAddBlock(block: WithOffset<ContentBlock>): PageResult {
		if (this.remainingHeight <= 0) {
			return {
				type: "page-completed",
				remainingBlock: block,
			};
		}

		let result: PageResult;
		switch (block.type) {
			case "heading":
				result = this.tryAddHeadingBlock(block);
				break;
			case "text":
				result = this.tryAddTextBlock(block);
				break;
			case "image":
				result = this.tryAddImageBlock(block);
				break;
			default:
				throw new Error(`Unknown block type`);
		}

		// TODO temporary fix to account for the paragraph spacing
		if (result.type === "page-has-space") {
			this.remainingHeight -= this.textMetrics.paragraphSpacing;
		}

		return result;
	}

	private tryAddHeadingBlock(block: WithOffset<HeadingBlock>): PageResult {
		if (this.blocks.length > 0) {
			return {
				type: "page-completed",
				remainingBlock: block,
			};
		}

		const headingHeight = this.calculateHeadingHeight(block.metadata.level);
		if (headingHeight > this.remainingHeight) {
			return {
				type: "page-completed",
				remainingBlock: block,
			};
		}

		this.blocks.push(block);
		this.remainingHeight -= headingHeight;

		return {
			type: "page-has-space",
			remainingHeight: this.remainingHeight,
		};
	}

	// When we carve up a text block, the content of the new block
	// is only the content that we haven't seen yet.
	// We keep track of the original offsets
	private tryAddTextBlock(block: WithOffset<TextBlock>): PageResult {
		const availableLines = Math.floor(
			this.remainingHeight /
				(this.textMetrics.fontSize * this.textMetrics.lineHeight)
		);
		const maxChars = availableLines * this.textMetrics.charsPerLine;

		// We must consider the case where we've already split the text block before
		const endOffset = block.blockOffset?.end ?? 0;

		// Case 1: Block content can fit within the maximum chars
		if (block.content.length <= maxChars) {
			const textHeight = this.calculateTextHeight(block.content);
			if (textHeight > this.remainingHeight) {
				throw new Error("SHOULD NOT OCCUR Text is too large to fit on a page");
			}

			const blockWithOffset = {
				...block,
				content: block.content,
				blockOffset: {
					start: endOffset,
					end: block.content.length,
				},
			};

			this.blocks.push(blockWithOffset);
			this.remainingHeight -= textHeight;

			return {
				type: "page-has-space",
				remainingHeight: this.remainingHeight,
			};
		}

		// Case 2: Block content is greater than the maximum characters
		// We go backwards from the maxChar to find the last whitespace character
		let splitIndex = maxChars; // Start at maxChars instead of maxChars - 1 because the next character is the one we want to split on
		while (splitIndex > 0 && !this.isWhitespace(block.content[splitIndex]!)) {
			splitIndex--;
		}

		// If there is no spilt index, i.e. no whitespace characters,
		// we have to split at the maxChars - 1 (to have space for a dash character)
		const noWhitespaceFound = splitIndex == 0;
		if (noWhitespaceFound) {
			splitIndex = maxChars - 1;
		}

		const firstPart = noWhitespaceFound
			? block.content.substring(0, splitIndex).trim() + "-"
			: block.content.substring(0, splitIndex);
		const remainingText = block.content.substring(splitIndex).trim();

		const completedBlock: WithOffset<TextBlock> = {
			...block,
			content: firstPart,
			blockOffset: {
				start: endOffset,
				end: endOffset + splitIndex,
			},
		};

		this.blocks.push(completedBlock);
		this.remainingHeight -= this.calculateTextHeight(firstPart);

		return {
			type: "page-completed",
			remainingBlock: {
				...block,
				content: remainingText,
				blockOffset: {
					start: endOffset + splitIndex,
					end: block.content.length,
				},
			},
		};
	}

	private calculateTextHeight(text: string): number {
		const lines = Math.ceil(text.length / this.textMetrics.charsPerLine);
		return lines * this.textMetrics.fontSize * this.textMetrics.lineHeight;
	}

	private isWhitespace(char: string): boolean {
		return /\s/.test(char);
	}

	private tryAddImageBlock(block: WithOffset<ImageBlock>): PageResult {
		const imageHeight = this.calculateImageHeight(block.metadata.dimensions);
		if (imageHeight > this.textMetrics.containerHeight) {
			throw new Error("SHOULD NOT OCCUR Image is too large to fit on a page");
		}

		if (imageHeight > this.remainingHeight) {
			return {
				type: "page-completed",
				remainingBlock: block,
			};
		}

		this.blocks.push(block);
		this.remainingHeight -= imageHeight;

		return {
			type: "page-has-space",
			remainingHeight: this.remainingHeight,
		};
	}

	private calculateHeadingHeight(level: number): number {
		// TODO update the scaling factor accordingly
		const scaleFactor = 2.5 - (level - 1) * 0.25;
		return (
			this.textMetrics.fontSize * this.textMetrics.lineHeight * scaleFactor
		);
	}

	private calculateImageHeight(dimensions?: {
		width: number;
		height: number;
	}): number {
		if (!dimensions) {
			// TODO update the default value for images with no dimensions accordingly
			return this.textMetrics.fontSize * this.textMetrics.lineHeight * 2;
		}

		const scaleFactor = Math.min(
			1,
			this.textMetrics.containerWidth / dimensions.width
		);
		return dimensions.height * scaleFactor;
	}

	public render(): string {
		const converter = new BlocksToHTMLConverter();
		return converter.convert(this.blocks);
	}
}

export class Paginator {
	private readonly containerWidth: number;
	private readonly containerHeight: number;
	private readonly fontSize: number;
	private readonly lineHeight: number;
	private readonly charsPerLine: number;
	private readonly pages: Array<Page> = [];

	public constructor(
		dimensions: { width: number; height: number },
		styling: { fontSize: number; lineHeight: number }
	) {
		this.containerWidth = dimensions.width;
		this.containerHeight = dimensions.height;
		this.fontSize = styling.fontSize;
		this.lineHeight = styling.lineHeight;
		this.charsPerLine = Math.floor(this.containerWidth / (this.fontSize * 0.5));
	}

	public calculatePages(blocks: Array<ContentBlock>): Array<Page> {
		const pages: Array<Page> = [];
		const textMetrics = {
			containerWidth: this.containerWidth,
			containerHeight: this.containerHeight,
			fontSize: this.fontSize,
			lineHeight: this.lineHeight,
			charsPerLine: this.charsPerLine,
			paragraphSpacing: this.fontSize * this.lineHeight * 1.5,
		};

		let currentPage = new Page(textMetrics);

		for (const block of blocks) {
			let pageResult = currentPage.tryAddBlock(block);
			while (
				pageResult.type === "page-completed" &&
				pageResult.remainingBlock
			) {
				pages.push(currentPage);
				currentPage = new Page(textMetrics);
				pageResult = currentPage.tryAddBlock(pageResult.remainingBlock);
			}
		}

		// Append the last page if we haven't yet
		if (pages.length > 0 && pages[pages.length - 1] !== currentPage) {
			pages.push(currentPage);
		}

		return pages;
	}
}

import { BlocksToHTMLConverter } from "@/lib/view/blocks2html";

export type TextBlock = {
	type: "text";
	content: string;
	metadata: {
		tag: string;
	};
};

export type RichTextSegment = {
	text: string;
	style?: {
		bold?: boolean;
		italic?: boolean;
		underline?: boolean;
	};
};

export type RichTextBlock = {
	type: "richtext";
	segments: Array<RichTextSegment>;
	metadata: {
		tag: string;
	};
};

export type ImageBlock = {
	type: "image";
	src: string;
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
export type ContentBlock =
	// | TextBlock
	ImageBlock | HeadingBlock | RichTextBlock;

type TextMetrics = {
	containerWidth: number;
	containerHeight: number;
	fontSize: number;
	lineHeight: number;
	paragraphSpacing: number;
};

type WithOffset<T extends ContentBlock> = T & {
	blockOffset?: {
		start: number;
		end: number;
	};
};

export type PageResult =
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
	private readonly canvasContext: OffscreenCanvasRenderingContext2D;
	/// TODO check if these fonts are acceptable
	private static readonly BASE_FONT = "ui-serif";
	private static readonly BASE_FONT_SIZE_PX = 24;
	private static readonly LINE_HEIGHT_FACTOR = 5 / 3;

	public constructor(textMetrics: TextMetrics) {
		this.textMetrics = textMetrics;
		this.remainingHeight = textMetrics.containerHeight;
		const canvas = new OffscreenCanvas(
			textMetrics.containerWidth,
			textMetrics.containerHeight
		);

		const context = canvas.getContext("2d");
		if (!context) {
			throw new Error("Failed to create canvas context");
		}
		this.canvasContext = context;
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
			case "image":
				result = this.tryAddImageBlock(block);
				break;
			case "richtext":
				result = this.tryAddRichTextBlock(block);
				break;
			default:
				throw new Error(`Unknown block type`);
		}

		// TODO temporary fix to account for the paragraph spacing
		if (result.type === "page-has-space") {
			// TODO: update the result accordingly
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

	private updateCanvasFont(segment: RichTextSegment): void {
		const fontStyle = [];
		if (segment.style?.bold) fontStyle.push("bold");
		if (segment.style?.italic) fontStyle.push("italic");
		const fontString = `${fontStyle.join(" ")} ${Page.BASE_FONT_SIZE_PX}px ${Page.BASE_FONT}`;
		this.canvasContext.font = fontString.trim();
	}

	private tryAddRichTextBlock(block: WithOffset<RichTextBlock>): PageResult {
		const lineHeight = Page.BASE_FONT_SIZE_PX * Page.LINE_HEIGHT_FACTOR;
		const hasSpaceLeft = this.remainingHeight >= lineHeight;
		if (!hasSpaceLeft) {
			return {
				type: "page-completed",
				remainingBlock: block,
			};
		}

		// Create offscreen canvas for text measurements
		const context = this.canvasContext;
		const maxWidth = this.textMetrics.containerWidth;

		// Track current line's words and width
		let currentLineWidth = 0;

		// wordIndex is the last uncompleted word in the current line
		const splitBlock = (
			segmentIndex: number,
			wordIndex: number
		): {
			completedBlock: WithOffset<RichTextBlock> | null;
			remainingBlock: WithOffset<RichTextBlock> | null;
		} => {
			if (segmentIndex >= block.segments.length) {
				throw new Error("SHOULD NOT OCCUR segmentIndex is out of bounds");
			}

			const segment = block.segments[segmentIndex]!;
			const words = segment.text
				.split(/(\s+)/)
				.filter((word) => word.trim() !== "");

			if (wordIndex >= words.length) {
				throw new Error("SHOULD NOT OCCUR wordIndex is out of bounds");
			}

			const isAllWordsOfPreviousSegmentCompleted = wordIndex === 0;

			if (isAllWordsOfPreviousSegmentCompleted) {
				return {
					completedBlock: {
						...block,
						segments: block.segments.slice(0, segmentIndex),
					},
					remainingBlock: {
						...block,
						segments: block.segments.slice(segmentIndex),
					},
				};
			}

			// TODO handle the original spaces
			const completedSegmentHalf = {
				...segment,
				text: words.slice(0, wordIndex).join(" "),
			};
			const remainingSegmentHalf = {
				...segment,
				text: words.slice(wordIndex).join(" "),
			};

			const completedSegments = [
				...block.segments.slice(0, segmentIndex),
				completedSegmentHalf,
			];
			const remainingSegments = [
				remainingSegmentHalf,
				...block.segments.slice(segmentIndex + 1),
			];

			return {
				completedBlock: {
					...block,
					segments: completedSegments,
				},
				remainingBlock: {
					...block,
					segments: remainingSegments,
				},
			};
		};

		// Process each segment of rich text
		for (const [segmentIndex, segment] of block.segments.entries()) {
			this.updateCanvasFont(segment);

			// TODO handle line breaks
			// TODO we should preserve the previous space in the word.
			// and from there we can handle multiple spaces, and just trim when it's the start of a new line
			const words = segment.text
				.split(/(\s+)/)
				.filter((word) => word.trim() !== "");

			for (const [wordIndex, word] of words.entries()) {
				const isStartOfLine = currentLineWidth === 0;
				const wordToMeasure = isStartOfLine ? word : " " + word;
				const wordWidth = context.measureText(wordToMeasure).width;

				// TODO handle words that are too long to fit on a line
				const exceedsLineWidth =
					currentLineWidth + wordWidth > maxWidth && currentLineWidth > 0;

				if (!exceedsLineWidth) {
					currentLineWidth += wordWidth;
					// Continue the same line
					continue;
				}

				// Complete current line
				this.remainingHeight -= lineHeight;
				const hasSpaceLeft = this.remainingHeight >= lineHeight;

				if (hasSpaceLeft) {
					currentLineWidth = wordWidth;
					// Just go to the next line for the next word
					continue;
				}

				// We need to partition the block at this word in this segment
				const { completedBlock, remainingBlock } = splitBlock(
					segmentIndex,
					wordIndex
				);

				if (!completedBlock) {
					throw new Error("SHOULD NOT OCCUR completedBlock is null");
				}

				this.blocks.push(completedBlock);

				if (!remainingBlock) {
					throw new Error(
						"SHOULD NOT OCCUR remainingBlock is null since we are in a valid word index"
					);
				}

				// TODO add offsets at a later stage
				return {
					type: "page-completed",
					remainingBlock: remainingBlock,
				};
			}
		}

		// Check the last line that we have
		if (currentLineWidth > 0) {
			this.remainingHeight -= lineHeight;
		}

		// Entire block fits within the page
		this.blocks.push(block);
		return {
			type: "page-has-space",
			remainingHeight: this.remainingHeight,
		};
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

	public constructor(
		dimensions: { width: number; height: number },
		styling: { fontSize: number; lineHeight: number }
	) {
		this.containerWidth = dimensions.width;
		this.containerHeight = dimensions.height;
		this.fontSize = styling.fontSize;
		this.lineHeight = styling.lineHeight;
	}

	public calculatePages(blocks: Array<ContentBlock>): Array<Page> {
		console.time("calculatePages");
		const pages: Array<Page> = [];
		const textMetrics = {
			containerWidth: this.containerWidth,
			containerHeight: this.containerHeight,
			fontSize: this.fontSize,
			lineHeight: this.lineHeight,
			paragraphSpacing: Math.ceil((this.fontSize * 4) / 3),
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
		if (
			pages.length === 0 ||
			(pages.length > 0 && pages[pages.length - 1] !== currentPage)
		) {
			pages.push(currentPage);
		}

		console.timeEnd("calculatePages");
		return pages;
	}
}

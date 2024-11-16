import { describe, it, expect, vi } from "vitest";
import { Page, type RichTextBlock, type TextMetrics } from "./pagination";

const textMetrics: TextMetrics = {
	containerWidth: 640,
	containerHeight: 720,
	fontSize: 16,
	lineHeight: 1.5,
	paragraphSpacing: 14,
};

class MockOffscreenCanvas {
	private readonly width: number;
	private readonly height: number;
	private readonly getContext: () => OffscreenCanvasRenderingContext2D;

	public constructor(width: number, height: number) {
		this.width = width;
		this.height = height;
		this.getContext = vi.fn().mockReturnValue({
			measureText: vi.fn().mockReturnValue({ width: 10 }),
		});
	}
}

vi.stubGlobal("OffscreenCanvas", MockOffscreenCanvas);

describe("Page", () => {
	it("should pass", () => {
		expect(true).toBe(true);
	});

	it("should render a block", () => {
		const richTextBlock: RichTextBlock = {
			type: "richtext",
			segments: [{ text: "Hello", style: {}, metadata: {} }],
			metadata: { tag: "p" },
		};
		const page = new Page(textMetrics);
		page.tryAddBlock(richTextBlock);
		expect(page.render()).toBe("<p>Hello</p>");
	});

	describe("checkIfPageContainsId", () => {
		it("should return false if page does not contain id", () => {
			const page = new Page(textMetrics);
			expect(page.checkIfPageContainsId("test")).toBe(false);
		});

		it("should return true if page contains id", () => {
			const page = new Page(textMetrics);
			page.tryAddBlock({
				type: "richtext",
				segments: [{ text: "Hello", style: {}, metadata: {} }],
				metadata: { tag: "p", id: "test" },
			});
			expect(page.checkIfPageContainsId("test")).toBe(true);
		});

		it("should return true if segment contains id", () => {
			const page = new Page(textMetrics);
			page.tryAddBlock({
				type: "richtext",
				segments: [{ text: "Hello", style: {}, metadata: { id: "test" } }],
				metadata: { tag: "p" },
			});
			expect(page.checkIfPageContainsId("test")).toBe(true);
		});

		it("should return true if id is nested", () => {
			const page = new Page(textMetrics);
			page.tryAddBlock({
				type: "richtext",
				segments: [{ text: "Hello", style: {}, metadata: { id: "test" } }],
				metadata: { tag: "p", id: "test3" },
			});
			expect(page.checkIfPageContainsId("test")).toBe(true);
		});
	});
});

import { HTMLToBlocksParser } from "@/lib/view/html2block";
import type {
	HeadingBlock,
	RichTextBlock,
	RichTextSegment,
} from "@/lib/view/pagination";
import { describe, expect, it } from "vitest";

const sampleHTMLInput = `
<section>
	<h1>Hello</h1>
	<p>World</p>
	<p><span epub:type="bridgehead">Andersen the consummate master.</span> Hans Christian Andersen is the
		acknowledged master of the modern story for children. What are the sources of
		his success? Genius is always unexplainable except in terms of itself, but some
		things are clear. To begin, he makes a mark—drives down a peg: "There came a
		soldier marching along <span epub:type="pagebreak" title="173" id="Page_173">173</span>
		the high road—<em>one, two! one, two!</em>" and you are off.
	</p>
	<p>
		<span epub:type="bridgehead">Wide range of the modern fairy tale.</span> The bibliography will suggest
		something of the treasures in the field of the modern fanciful story. From the
		delightful nonsense of <cite>Alice in Wonderland</cite> and the "travelers' tales" of
		<cite>Baron Munchausen</cite> to the profound seriousness of <cite>The King of the
		Golden River</cite> and <cite>Why the Chimes Rang</cite> is a far cry. There are the
		rich fancies of Barrie and Maeterlinck, at the same time delicate as the
		promises of spring and brilliant as the fruitions of summer. One may be blown
		away to the land of Oz, he may lose his shadow with Peter Schlemihl, he may
		outdo the magic carpet with his Traveling-Cloak, he may visit the courts of
		kings with his Wonderful Chair; Miss Muffet will invite us to her Christmas
		party, Lemuel Gulliver will lead us to lands not marked in the school atlas; on
		every side is a world of wonder.
	</p>
	<p><span epub:type="bridgehead">Some qualities of these modern tales.</span> Every age produces after its own
		fashion, and we must expect to find the modern user of the fairy-story method
		expressing through it the qualities of his own outlook upon the world. Interest
		in the picturesque aspects of landscape will be emphasized, as in the early
		portions of "The Story of Fairyfoot" and, with especial magnificence of style,
		throughout <cite>The King of the Golden River</cite>. There will appear the saddened
		mood of the modern in the face of the human miseries that make happiness a
		mockery, as in "The Happy Prince." The destructive effects of the possessive
		instinct upon all that is finest in human nature is reflected in "The Prince's
		Dream." That the most valuable efforts are often those performed with least
		spectacular settings may be discerned in "The Knights of the Silver Shield,"
		while the lesson of kindly helpfulness is the burden of "Old Pipes and the
		Dryad." In many modern stories the reader is too much aware of the conscious
		efforts of style and structure. The thoughtful child will sometimes be too much
		distressed by the more somber modern story, and should not hear too many of the
		gloomy type.
	</p>
</section>
`;

describe("HTMLToBlocksParser", () => {
	it("should parse the sample HTML input", () => {
		const parser = new HTMLToBlocksParser();
		const blocks = parser.parse(sampleHTMLInput);

		expect(blocks).toBeDefined();
		expect(blocks.length).toBe(5);

		expect(blocks[0]!.type).toBe("heading");
		expect((blocks[0] as HeadingBlock).content).toBe("Hello");

		expect(blocks[1]!.type).toBe("richtext");
		expect((blocks[1] as RichTextBlock).segments.length).toBe(1);

		const richTextBlock = blocks[2] as RichTextBlock;
		expect(richTextBlock.segments.length).toBe(6);
		const emphasisSegment = richTextBlock.segments[4] as RichTextSegment;
		expect(emphasisSegment.style).toMatchObject({
			italic: true,
			underline: false,
			bold: false,
		});
		expect(emphasisSegment.text).toBe("one, two! one, two!");
	});

	it("should parse the nested HTML input", () => {
		const nestedHTMLInput = `
		<section>
			<section>
				<section>
					<h5>Hello</h5>
					<p>World</p>
				</section>
			</section>
		</section>
		`;
		const parser = new HTMLToBlocksParser();
		const blocks = parser.parse(nestedHTMLInput);

		expect(blocks.length).toBe(2);
		const headingBlock = blocks[0] as HeadingBlock;
		expect(headingBlock.content).toBe("Hello");

		const richTextBlock = blocks[1] as RichTextBlock;
		expect(richTextBlock.segments.length).toBe(1);
		const textSegment = richTextBlock.segments[0] as RichTextSegment;
		expect(textSegment.text).toBe("World");
		expect(textSegment.style).toMatchObject({
			bold: false,
			italic: false,
			underline: false,
		});
	});

	it("should parse multiple paragraph blocks", () => {
		const multipleParagraphsInput = `
		<section>
			<p>Hello</p>
			<p>World</p>
			<p>Andersen</p>
			<p>The End</p>
			<p>The End 2 </p>
		</section>
		`;
		const parser = new HTMLToBlocksParser();
		const blocks = parser.parse(multipleParagraphsInput);
		expect(blocks.length).toBe(5);
		expect(blocks[0]!.type).toBe("richtext");
		expect(blocks[1]!.type).toBe("richtext");
		expect(blocks[2]!.type).toBe("richtext");
		expect(blocks[3]!.type).toBe("richtext");
		expect(blocks[4]!.type).toBe("richtext");

		const firstRichTextBlock = blocks[0] as RichTextBlock;
		expect(firstRichTextBlock.segments.length).toBe(1);
		expect(firstRichTextBlock.segments[0]!.text).toBe("Hello");

		const secondRichTextBlock = blocks[1] as RichTextBlock;
		expect(secondRichTextBlock.segments.length).toBe(1);
		expect(secondRichTextBlock.segments[0]!.text).toBe("World");

		const thirdRichTextBlock = blocks[2] as RichTextBlock;
		expect(thirdRichTextBlock.segments.length).toBe(1);
		expect(thirdRichTextBlock.segments[0]!.text).toBe("Andersen");

		const fourthRichTextBlock = blocks[3] as RichTextBlock;
		expect(fourthRichTextBlock.segments.length).toBe(1);
		expect(fourthRichTextBlock.segments[0]!.text).toBe("The End");

		const fifthRichTextBlock = blocks[4] as RichTextBlock;
		expect(fifthRichTextBlock.segments.length).toBe(1);
		expect(fifthRichTextBlock.segments[0]!.text).toBe("The End 2 ");
	});
});

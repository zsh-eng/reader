import { readFile } from "fs/promises";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { EPUBParser } from "./parser";

describe("EPUBParser", () => {
	async function getParser(): Promise<EPUBParser> {
		const epubPath = join(
			__dirname,
			"./__tests__/__fixtures__/valid/childrens-literature.epub"
		);
		const epubBuffer = await readFile(epubPath);

		const epubArrayBuffer = new ArrayBuffer(epubBuffer.length);
		new Uint8Array(epubArrayBuffer).set(new Uint8Array(epubBuffer));

		return EPUBParser.createParser(epubArrayBuffer);
	}

	it("should parse metadata correctly", async () => {
		const parser = await getParser();
		const metadata = parser.getMetadata();

		expect(metadata).toBeDefined();
		expect(metadata).toEqual({
			title: "Children's Literature",
			subtitle:
				"A Textbook of Sources for Teachers and Teacher-Training Classes",
			fullTitle:
				"Children's Literature: A Textbook of Sources for Teachers and Teacher-Training Classes",
			creator: "Curry, Charles Madison; Clippinger, Erle Elsworth",
			language: "en",
			identifier: "http://www.gutenberg.org/ebooks/25545",
		});
	});

	it("should parse navigation correctly", async () => {
		const parser = await getParser();
		const navigation = parser.getNavigation();

		expect(navigation).toBeDefined();
		expect(navigation).toHaveLength(1);

		const navPoint = navigation[0]!;
		expect(navPoint).toBeDefined();
		expect(navPoint.id).toBe("nav-1-1");
		expect(navPoint.label).toBe(
			"SECTION IV FAIRY STORIES—MODERN FANTASTIC TALES"
		);
		expect(navPoint.src).toBe("s04.xhtml#pgepubid00492");
		expect(navPoint.order).toBe(1);

		const children = navPoint.children;
		expect(children).toBeDefined();
		expect(children).toHaveLength(11);

		const child = children[0]!;
		expect(child).toBeDefined();
		expect(child.id).toBe("nav-2-1");
		expect(child.label).toBe("BIBLIOGRAPHY");
		expect(child.src).toBe("s04.xhtml#pgepubid00495");
		expect(child.order).toBe(1);

		const secondChild = children[1]!;
		expect(secondChild).toBeDefined();
		expect(secondChild.id).toBe("nav-2-2");
		expect(secondChild.label).toBe("INTRODUCTORY");
		expect(secondChild.src).toBe("s04.xhtml#pgepubid00498");
		expect(secondChild.order).toBe(2);
	});

	it("should parse spine correctly", async () => {
		const parser = await getParser();
		const spine = parser.getSpine();
		expect(spine).toBeDefined();
		expect(spine).toHaveLength(3);
		expect(spine[0]).toBe("cover");
		expect(spine[1]).toBe("nav");
		expect(spine[2]).toBe("s04");
	});

	it("should parse manifest correctly", async () => {
		const parser = await getParser();
		const manifest = parser.getManifest();
		expect(manifest).toBeDefined();
		expect(Object.keys(manifest)).toHaveLength(7);

		// Test cover image
		expect(manifest["cover-img"]).toBeDefined();
		expect(manifest["cover-img"]).toEqual({
			id: "cover-img",
			path: "images/cover.png",
			mediaType: "image/png",
			properties: ["cover-image"],
		});

		// Test CSS files
		expect(manifest["css01"]).toBeDefined();
		expect(manifest["css01"]).toEqual({
			id: "css01",
			path: "css/epub.css",
			mediaType: "text/css",
			properties: [],
		});

		expect(manifest["css02"]).toBeDefined();
		expect(manifest["css02"]).toEqual({
			id: "css02",
			path: "css/nav.css",
			mediaType: "text/css",
			properties: [],
		});

		// Test XHTML files
		expect(manifest["cover"]).toBeDefined();
		expect(manifest["cover"]).toEqual({
			id: "cover",
			path: "cover.xhtml",
			mediaType: "application/xhtml+xml",
			properties: [],
		});

		expect(manifest["s04"]).toBeDefined();
		expect(manifest["s04"]).toEqual({
			id: "s04",
			path: "s04.xhtml",
			mediaType: "application/xhtml+xml",
			properties: [],
		});

		expect(manifest["nav"]).toBeDefined();
		expect(manifest["nav"]).toEqual({
			id: "nav",
			path: "nav.xhtml",
			mediaType: "application/xhtml+xml",
			properties: ["nav", "scripted"],
		});

		// Test NCX file
		expect(manifest["ncx"]).toBeDefined();
		expect(manifest["ncx"]).toEqual({
			id: "ncx",
			path: "toc.ncx",
			mediaType: "application/x-dtbncx+xml",
			properties: [],
		});
	});

	it("should be able to read a chapter", async () => {
		const parser = await getParser();
		const chapter = await parser.getChapterContent("s04");

		expect(chapter).toBeDefined();
		expect(chapter.id).toBe("s04");
		expect(chapter.title).toBe(
			"Section IV: FAIRY STORIES—MODERN FANTASTIC TALES"
		);
		expect(chapter.html).toBeDefined();
		expect(chapter.text).toBeDefined();
		expect(chapter.images).toBeDefined();
	});
});

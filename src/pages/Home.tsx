import { EPUBParser } from "@/lib/epub/parser";
import { useState, type ChangeEvent } from "react";
import type { FunctionComponent } from "../common/types";

export const Home = (): FunctionComponent => {
	const [htmlContent, setHtmlContent] = useState<string>("");

	const onFileChange = async (
		event: ChangeEvent<HTMLInputElement>
	): Promise<void> => {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}

		console.log(file);

		const arrayBuffer = await file.arrayBuffer();
		const parser: EPUBParser = await EPUBParser.createParser(arrayBuffer);
		const chapterContent = await parser.getChapterContent("s04");
		setHtmlContent(chapterContent.html);
	};

	return (
		<div className="w-screen h-screen flex flex-col justify-center items-center">
			<h1>Hello World</h1>
			<input
				accept="application/epub+zip"
				id="book"
				name="book"
				type="file"
				onChange={onFileChange}
			/>

			<article
				dangerouslySetInnerHTML={{ __html: htmlContent }}
				className="w-full h-full prose"
			/>
		</div>
	);
};

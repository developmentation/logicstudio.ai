Okay, here's a markdown document showcasing various table layouts with explanations and examples:

# Markdown Table Layouts

This document demonstrates different ways to create tables in Markdown, along with some common styling and formatting techniques.

## Basic Table

The most basic way to create a table uses pipes (`|`) to separate columns and hyphens (`-`) to create the header separator.

| Header 1     | Header 2     | Header 3     |
| ------------ | ------------ | ------------ |
| Row 1, Col 1 | Row 1, Col 2 | Row 1, Col 3 |
| Row 2, Col 1 | Row 2, Col 2 | Row 2, Col 3 |
| Row 3, Col 1 | Row 3, Col 2 | Row 3, Col 3 |

Table with Different Text Alignments

You can control the alignment of text within columns using colons (:) in the separator row:

:-- for left alignment
:-: for center alignment
--: for right alignment
| Left Aligned | Center Aligned | Right Aligned |
|:-----------|:--------------:|------------:|
| Text Left | Center Text | Text Right |
| Another Left| Another Center | Another Right|
| More Text | More Center | More Right |

If you don't need a header, you can omit the header row and just start with the separator.

|---|---|
| Data 1 | Data 2 |
| More Data | Even More Data |

Table with Varying Column Width

Markdown tables will automatically adjust column widths based on the content. You don't need to explicitly define widths. However, be aware of very long lines.

| Short Column | Longer Column that will wrap the text                                  | Another Column |
| ------------ | ---------------------------------------------------------------------- | -------------- |
| Some Data    | This is a longer line of text that will likely wrap within the column. | More data      |
| More Data    | This also will wrap.                                                   | Even more      |

Table with Markdown in Cells

You can include other markdown formatting within table cells:

| **Bold**   | _Italic_ | `Code`      | [Link](https://www.example.com)        |
| ---------- | -------- | ----------- | -------------------------------------- |
| Value 1    | Value 2  | `data`      | A link                                 |
| Second Row | Row 2    | `more code` | [Another Link](https://www.google.com) |

Tables can contain a mixture of different data types like text, numbers, and lists.

| Name  | Age | Interests                                  |
| ----- | --- | ------------------------------------------ |
| Alice | 30  | Reading, Hiking                            |
| Bob   | 25  | Programming, Gaming                        |
| Carol | 35  | <ul><li>Cooking</li><li>Painting</li></ul> |

Markdown table rendering can vary slightly between different Markdown parsers.
Complex layouts and advanced styling are generally not achievable with just basic Markdown. For more complex tables, you might need HTML or CSS.
Avoid very long, unbroken lines of text in cells, as they can break table formatting in some renders.

This document should give you a good foundation for creating a variety of tables in Markdown.

This markdown document will render in most markdown viewers/editors and will demonstrate the different types of table layouts explained. You can copy and paste this into your markdown file and the viewer you use will display the tables as shown in the "Rendered Output" sections. Let me know if you have other questions!

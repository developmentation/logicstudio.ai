# Known bugs / pending items

## Project Delivery

- Create a dev branch and dev.logicstudio.ai to permit testing new features without breaking the old features.

## Bugs

- Slow performance when there is lots of screen data-refactor to limit refreshes.
- Canvas overflow off to the lower right hand side.
- Screen glitch: Trigger, Agent, and Chat cards cause the screen to relocate.
- Text card: Maintain whitespace within the component when saving. Carriage returns are lost when importing. Doesn't impact the LLM, but readability takes a hit.

## Enhancements to Exiting Cards

- Shift click Join or View. Make all the connections for join, or make multiple views. Let view have multiple sockets for multiple segments
- Text Card: Split on regex or string matching for long documents.

## Pending Features

- Webhook - Inbound and outbound webhook traffic, including a potential to permit socket connections of 3rd party services to logicstudio AI for real-time communications protocols. Create a 'friendly' websocket name for easy integration, including static names (if there is a DB)
- Goals
- Memory
- Deploy - This would be a critical feature to actually deploy the agent to be headlessly operating in the background and be able to start it and stop it with a secret key embedded in the Canvas itself. That way you could control the interactivity. It would need to adopt the reactivity of the UI component.

## Future Features (Tracker, no timeline)

- ExcelCard: An Excel processor which will process every sheet into separate sockets.
- WordCard: A Word Docx processor which will do the same, but also preserve the styling so the AI can mimic. Import images as well as - Batch Processor - A batch processor where you load a PDF or Word, and then it OCRs the whole thing (pages or images), and merges it into a JSON for example with structured outputs for 100% of the content. New OCR agent which can take an entire set of images and build out the contents as separate calls via the LLM.
  separate.
- JSON to Form Card - Receive JSON array of field types, and display the input as a form to collect user input, and then finalize the JSON
- Canvas Inputs and Outputs - Pass content between two canvases in the workspace, like webhooks
- Google or other search service API calls, which return pages and links for analysis
- Database integration - Load and navigate schemas, tables, and view and search data. Receive select / CRUD queries and execute them
- Execute code on the server side and return results.
- Extract out JSON and Code from responses and store them in separate objects.

## Landing Page

- Build out a robust catalogue of agentic workflows.
- Develop a training portla land documents.
- Post videos.
- Show other solutions, like n8n/
- Create a step by step for how to deploy, including a video with each card.
- Update features list
- Update the GitHUb readme.md
- Add the current app version to the homepage.

## Canvases

- Exporting and Importing canvases should persist the zoom and the location of the export, so that it loads with the same view as export.
- Make the drawSpline more loopy when drawing to the left so that linking backward has a nice display
- Add a 'cog' control to permit description, or bringing keys into the canvas element instead of the card

## Reactivity

- There seems to be a significant over processing of the reactive variables whenever the UI moves.

## Studio / Canvas

- The ConnectionsLayer seems to have shifted off the central point of the canvas.
- The touch actions have seriously fallen out of sync with the mouse events, bring them back into alignment
- Adding some cards creates an unexpected scroll back to the centre of the Canvas. Not all cards cause this, but Chat for example seems to.
  - - Happens on Agent, Chat and Trigger card, seemingly due to some complex socket registration event emissions.

## Join

- Create another join for JSON, whereby multiples are brought into an array (higheset level element) or they are brought into an Object, with the socket name the unique object.
- Join by type, JSON, array, text, or images

## BaseCard

- Generally, PrimeVue components cause slowdowns. Loading several repositories causes the UI to significantly slowdown
- Likely there is excessive reactivity happening across all the components
- Multiselect remains buggy

## Input Card

- Loading Word and PDF documents doesn't result in text being handed. Use proper importing
- Images are not permitted
- Feature Request: OCR files on input

## API

- In addition to trigger, create multiple named input sockets, each of which is a req.body parameter for the method.

## Web

- Preserve the whitespace for web scraping content so it is easier to read and edit
- Enable the return of links for web crawling

## View

- Enable the reading / receipt of JSON or text, without showing [Object object]

## Optimizations

- Remove PrimeVue and any other unnecessary plugins / libraries. Revert just back to Tailwind CSS and build out a custom stylesheet.

## Export

- Export the screen into a high resolution PNG or JPG.

## Node.js backend

- Test and better integrate the ApiError and apiErrorHandler
- Add in an optinal logger to track known issues and failures

## Agent Card

- Refactoring Agents and Chats can accept image inputs and process them all as part of the prompt

## Completed Features (DONE)

- User request: Make the GitHub card process a URL into owner/repo (2025-01-20)
- Experimental: Permit multiple connections to the same input, with the last output update overwriting the input.
- PDF: The PDF function now accepts large mixed content PDFs and extracts out images from text.

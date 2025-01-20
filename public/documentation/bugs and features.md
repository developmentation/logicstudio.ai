# Known bugs / pending items

## Project Delivery
- Create a dev branch and dev.logicstudio.ai to permit testing new features without breaking the old features.

## Pending Features
- Webhook - Inbound and outbound webhook traffic, including a potential to permit socket connections of 3rd party services to logicstudio AI for real-time communications protocols. Create a 'friendly' websocket name for easy integration, including static names (if there is a DB)
- Goals
- Memory
- Deploy - This would be a critical feature to actually deploy the agent to be headlessly operating in the background and be able to start it and stop it with a secret key embedded in the Canvas itself. That way you could control the interactivity. It would need to adopt the reactivity of the UI component.

## Future Features
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
- Allow multiple inputs per socket, and have them overwrite the inputs based on the last updated
- Adding some cards creates an unexpected scroll back to the centre of the Canvas. Not all cards cause this, but Chat for example seems to.

## Join
- Create another join for JSON, whereby multiples are brought into an array (higheset level element) or they are brought into an Object, with the socket name the unique object.

## BaseCard
-  Generally, PrimeVue components cause slowdowns. Loading several repositories causes the UI to significantly slowdown
- Likely there is excessive reactivity happening across all the components
- Multiselect remains buggy 

## Input Card
- Loading Word and PDF documents doesn't result in text being handed. Use proper importing
- Images are not permitted
- Feature Request: OCR files on input

## Text
- Maintain whitespace within the component when saving. Carriage returns are lost when importing. Doesn't impact the LLM, but readability takes a hit.

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

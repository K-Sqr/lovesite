# Us Machina — Future Features

## 1. Site Cleanup & Proposal Archive
- Clean up the main landing page to feel welcoming and intimate rather than leading with the "asking out" animation.
- Move the original proposal animation (text reveal, Yes/No buttons, graffiti rain) to its own dedicated page/tab (e.g. "Our Origin" or "How It Started") so it's preserved as an artifact but doesn't dominate the homepage.
- Rethink the homepage as a warm entry point — could feature the love counter, a highlight reel, or a short greeting.

## 2. Encrypted Memories
- Viewing protection: require a shared password to view any images on the Memories page. Without it, visitors see a locked state (blurred grid or a password prompt).
- Upload protection: require a separate, stronger password to upload new images. This is distinct from the viewing password so only the two of you can add content.
- Delete protection: only authenticated uploaders (using the upload password) can remove images.
- Consider server-side enforcement via Firebase Security Rules so passwords can't be bypassed from the browser console.

## 3. Protected Milestones & Landmarks
- Require authentication (same upload-tier password) to add, edit, or delete milestones and landmarks on the Timeline page.
- Eventually move milestone data from a static JS file to Firestore so entries can be managed from the site itself without code changes.
- Add an inline "Add Milestone" form on the Timeline page, gated behind the password.

## 4. bugs.

- On pc screen some of the words in the index page asking her out cuts off into a new line, for example, "reality", cuts off into "r" \n "eality" and with into w and then iith.

- In memories, any passcode currently works. So anyone can upload images. Also I want to just set up a password from the backend that we can both use.

- Also from on the memories page, I want to be able to delete memories from the website, so I dont have to go do it manually on fire base. Add an option to inlcude captions when an image is uploaded.

- On the first page after yes is clicked, I want the page to smoothly navigate to our story so far.


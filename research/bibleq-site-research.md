# BibleQ Research Notes

Source site reviewed on July 14, 2026: [bibleq.com](https://bibleq.com/)

## What BibleQ offers

BibleQ is a Bible quizzing resource hub centered on the Berean Standard Bible (BSB). The site is organized around five main content areas:

- `Scripture Portions`: printable and machine-readable quiz material by book set
- `Questions`: prepared question banks grouped by question type
- `Software`: a downloadable quiz generator and documentation for its data model
- `Audio`: chapter-level audio for memorization and listening practice
- `Tools`: concordances, unique-word lists, and links to Berean data tables

For our tool, this is valuable because it shows both the content formats that quiz users already expect and the workflow used to build printable quiz packets.

## High-value product ideas pulled from the site

### 1. Support the same source material formats

BibleQ distributes portions in these formats:

- PDF
- Word
- Excel
- plain text
- "unique words bold" PDF variants

That suggests our tool should treat scripture as structured data, not just plain paragraphs. A good internal model would include:

- book group
- chapter
- verse
- verse text
- normalized text
- optional "unique word" markers

### 2. Model multiple quiz question types

BibleQ question banks are split into distinct specialty files. Across the site, these include:

- `Regular`
- `Memory`
- `Reference`
- `Situation`
- `FTV` / `FTVR` / `Quote` concepts mentioned in the generator docs

This is one of the strongest signals for the app design: question type is a first-class entity, not just a label.

Recommended domain model:

- `question_id`
- `source_passage`
- `question_type`
- `prompt`
- `answer`
- `book`
- `chapter`
- `verse`
- `difficulty`
- `tags`

### 3. Use verse-based distribution when generating quizzes

The quiz generator documentation explains a `sectoring` system:

- quizzes can be divided by `chapters` or by `verses`
- each quiz contains one question from each sector
- this helps cover all parts of the material
- it avoids two questions from the same verse
- consecutive questions usually come from different areas

That is a strong blueprint for a fair randomizer. Our generator should likely support:

- balanced coverage across the material
- no duplicate verse in the same quiz
- configurable chapter weighting
- configurable specialty placement

### 4. Preserve printable and live-hosted output modes

BibleQ's software supports output to:

- `paper`
- `cards`
- `table`

That maps well to three modern outputs:

- host mode for live quizmaster use
- printable packet / PDF export
- structured export for Sheets, CSV, or database import

### 5. Build study aids, not only quizzes

BibleQ also provides:

- concordances
- unique-word lists in numerical and alphabetical order
- audio files
- scripture portions with bolded unique words

That means a full-featured tool should include study workflows, such as:

- listen by chapter
- practice by unique words
- search by rare terms
- drill by verse reference
- quiz from concordance hits or filtered passages

## Useful technical clues from the Quiz Generator docs

From [software.htm](https://bibleq.com/software.htm):

- generated quiz output uses a `.qui` extension
- run metadata and issue logging use a `.inf` extension
- question data files are `tab delimited`
- the expected fields are `verse`, `type`, `question`, and `answer`
- edited files should stay `sorted by verse number`
- the tool can generate up to `135` quizzes in one run
- a quiz pack can contain up to `30` questions
- `A and B` question numbering starts at a configurable point
- `specialty ranges` can be limited and positioned
- repeats are controlled by a configurable eligibility percentage

This is probably the single most useful implementation guidance on the site because it describes the hidden schema behind the generator.

## Features our version should likely include

### Core MVP

- import scripture from text, xlsx, or scraped sources
- import question banks by type
- generate balanced quiz packets
- host a live quizmaster screen
- show question, answer, verse, and type
- track which verses and question types were already used

### Strong next features

- audio-linked study mode
- unique-word practice mode
- filter by chapter range or custom portion
- export to PDF / DOCX / CSV
- randomizer settings that mimic BibleQ sectoring
- configurable specialty schedules

### Admin / content tools

- editor for tab-delimited question banks
- duplicate detection
- verse-sort validator
- broken-answer / missing-reference checks
- quiz history logs

## Data sources on the site that look reusable

Most reusable content categories on BibleQ:

- scripture text files such as `acts.txt`, `john.txt`, `mat.txt`
- scripture spreadsheets such as `acts.xlsx`, `john.xlsx`
- compiled question spreadsheets such as `john_bsb_wbqa_questions.xlsx`
- specialty Word docs such as `john_bsb_reg.docx`, `john_bsb_mem.docx`
- concordance PDFs
- unique-word lists
- chapter audio MP3 files

If we build an importer, the most promising inputs are the `txt` and `xlsx` assets first, because they are easier to parse than PDFs and Word docs.

## Licensing and handling notes

Important caution from the site content:

- The site says resources are free to `download, print, and share`.
- Audio permissions differ by section. Some say `You are free to copy and distribute as needed`; others say `General permission to use but not edit`.
- The scripture text is tied to the `Berean Standard Bible`, so if we redistribute content inside an app, we should keep source attribution and verify any reuse rules before packaging large amounts of text.

Because of that, a safe first step is:

- store links and import pipelines
- keep attribution metadata
- avoid blindly republishing full third-party datasets inside a public product without a separate license check

## Suggested architecture direction for this repo

Based on BibleQ, a strong app structure would be:

1. `content ingestion`
2. `question bank normalization`
3. `quiz generation engine`
4. `live quizmaster interface`
5. `study tools`
6. `export and print layer`

Possible normalized tables:

- `scripture_verses`
- `question_bank`
- `question_types`
- `quiz_templates`
- `generated_quizzes`
- `quiz_runs`
- `audio_tracks`
- `study_indexes`

## Source pages reviewed

- [Home](https://bibleq.com/)
- [Scripture Portions](https://bibleq.com/portions.htm)
- [Questions](https://bibleq.com/questions.htm)
- [Software](https://bibleq.com/software.htm)
- [Audio](https://bibleq.com/audio.htm)
- [Tools](https://bibleq.com/tools.htm)

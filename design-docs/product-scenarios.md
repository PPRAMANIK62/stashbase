# Product Scenarios

These scenarios explain why people use an IDE for writing. They are desired
outcomes, not mandatory screen sequences. The capabilities below are available;
the incomplete document-specific diff is tracked in
[Product Direction](product-direction.md#document-specific-diff--remaining-feature).

## Explore an Idea before Writing

A person opens or creates a project and starts a conversation about a question,
a rough premise, or several possible directions. The project may be empty.
They use the Agent to brainstorm, challenge assumptions, compare approaches,
and continue the discussion without first producing a document or wiki.

The result may be a clearer idea or a conversation worth returning to. Writing
an outline or draft is a deliberate continuation, not a condition of success.

Related journeys: [J02](user-journeys.md#j02-add-and-open-a-folder),
[J06](user-journeys.md#j06-start-and-continue-an-agent-chat), and
[J10](user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work).

## Develop Writing from Project Material

A researcher, student, or professional brings papers, notes, scans, recordings,
or earlier work into a project. They discuss a question, consult relevant
material, develop an outline or draft, and revise it with the Agent or directly
in the editor. References stay identifiable as the writing evolves.

Preparation, keyword or optional meaning-based retrieval, and source-linked
wiki pages help use that material. None is an obligatory step before a
conversation. A report, article, proposal, or set of notes remains an ordinary
local file that other tools can use.

Related journeys: [J03](user-journeys.md#j03-read-and-edit-source-documents),
[J04](user-journeys.md#j04-prepare-a-hard-to-read-file),
[J05](user-journeys.md#j05-search-and-open-source-evidence),
[J07](user-journeys.md#j07-converge-chat-into-a-document), and
[J08](user-journeys.md#j08-connect-an-external-agent-through-mcp).

## Revise and Continue Existing Work

A writer returns to an existing project and conversation, opens a draft,
discusses alternatives, and makes focused changes. Current editing, Agent
change reports, and save-conflict handling support this work. The planned
completion of document-specific diff will improve how those changes are
understood and reviewed; revising and saving documents already work.

Related journeys: [J03](user-journeys.md#j03-read-and-edit-source-documents),
[J06](user-journeys.md#j06-start-and-continue-an-agent-chat),
[J07](user-journeys.md#j07-converge-chat-into-a-document), and
[J10](user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work).

## Organize References or Start from an Example

A person can ask an Agent to build linked wiki pages over project sources, or
copy an example from the Gallery and work with that local project. This is a
supported way to understand material and find inspiration for writing. It does
not create a separate global knowledge store or replace the person's sources.

Related journeys: [J12](user-journeys.md#j12-build-wiki-pages-from-a-local-folder)
and [J13](user-journeys.md#j13-download-a-ready-made-wiki-from-the-gallery).

## Core Product Scenario

Enter a project, discuss ideas, and move into drafting, revision, and review
when useful. Existing local files can be references or work in progress; a new
project can begin with neither. Discussion and writing can alternate, and
accepted content becomes durable through explicit file work.

[J10](user-journeys.md#j10-turn-a-local-project-into-durable-agent-assisted-work)
is the primary project workflow. The retained
[J11](user-journeys.md#j11-turn-a-conversation-into-a-project) describes the
secondary unbound-conversation creation boundary and its in-app entry
limitation; it is not the onboarding route.

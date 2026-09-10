/**
 * The bundled copy of the published index.
 *
 * A shop window prefers a slightly stale list over a spinner and a bundled list
 * over an empty state, so this renders first and the published index replaces
 * it when the network answers. It is also the whole answer offline. Refresh it
 * when the gallery changes in a way a release should ship with; the runtime
 * fetch covers everything in between.
 */
import type { GalleryEntry } from './entry';

export const GALLERY_SNAPSHOT: readonly GalleryEntry[] = [
  {
    category: 'course',
    contents:
      '20 lecture transcripts · distilled founder playbook · STASHBASE.md maintenance rules',
    description: "Sam Altman's Stanford CS183B course with YC.",
    files: [
      'README.md',
      'STASHBASE.md',
      'founder_playbook.html',
      'transcripts/Lecture01-HowToStart.md',
      'transcripts/Lecture02-TeamExecution.md',
      'transcripts/Lecture03-BeforeStartup.md',
      'transcripts/Lecture04-BuildTalkGrow.md',
      'transcripts/Lecture05-BusinessMonopoly.md',
      'transcripts/Lecture06-Growth.md',
      'transcripts/Lecture07-ProductsUsersLove.md',
      'transcripts/Lecture08-DontScalePR.md',
      'transcripts/Lecture09-RaiseMoney.md',
      'transcripts/Lecture10-CultureTeamI.md',
      'transcripts/Lecture11-CultureTeamII.md',
      'transcripts/Lecture12-Enterprise.md',
      'transcripts/Lecture13-GreatFounder.md',
      'transcripts/Lecture14-Operate.md',
      'transcripts/Lecture15-Manage.md',
      'transcripts/Lecture16-UserInterview.md',
      'transcripts/Lecture17-Hardware.md',
      'transcripts/Lecture18-LegalAccounting.md',
      'transcripts/Lecture19-SalesMarketing.md',
      'transcripts/Lecture20-LaterStageAdvice.md',
    ],
    id: 'how-to-start-a-startup',
    learnMore: 'https://stashbase.ai/examples/cs183b/',
    name: 'How to Start a Startup',
    repo: 'https://github.com/0-bingwu-0/stashbase-cs183b',
    screenshots: null,
    starterPrompts: [
      'How do I find a startup idea?',
      'How do I know if I have product-market fit?',
      'Should I worry about competitors and being copied?',
    ],
    wikiPrompt:
      'Build or update Wiki Pages from these lecture transcripts: one page per lecture with its key ideas, and a founder playbook that connects them.',
  },
];

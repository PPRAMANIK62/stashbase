import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowRight, FileText } from 'lucide-react';

import {
  Card,
  CardButton,
  CardContent,
  CardDescription,
  CardFooter,
  CardGroup,
  CardHeader,
  CardTitle,
} from './card';

const meta = {
  title: 'Data Display/Card',
  component: Card,
  subcomponents: { CardGroup, CardHeader, CardTitle, CardDescription, CardContent, CardFooter },
  parameters: { fluidCanvas: { width: '32rem', minHeight: '20rem' }, layout: 'padded' },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj;

export const DocumentCard: Story = {
  render: () => (
    <Card className="w-96 max-w-full" onClick={() => undefined}>
      <CardHeader>
        <CardTitle>Project overview</CardTitle>
        <CardDescription>Markdown · updated 12 minutes ago</CardDescription>
      </CardHeader>
      <CardContent>
        A local project note with preparation state and a compact action surface.
      </CardContent>
      <CardFooter>
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <FileText size={14} /> 2,480 words
        </span>
      </CardFooter>
    </Card>
  ),
};

export const Grid: Story = {
  render: () => (
    <CardGroup border="outlined" className="w-full max-w-3xl" columns={2} separated>
      {['Research', 'Planning', 'Design', 'Archive'].map((name) => (
        <Card key={name} onClick={() => undefined}>
          <CardHeader>
            <CardTitle>{name}</CardTitle>
            <CardDescription>12 documents</CardDescription>
          </CardHeader>
          <CardFooter>
            <CardButton icon={ArrowRight} iconPosition="end" onClick={() => undefined}>
              Open
            </CardButton>
          </CardFooter>
        </Card>
      ))}
    </CardGroup>
  ),
};

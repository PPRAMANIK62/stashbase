import { Badge } from '@/components/ui/badge';
import { Elevated } from '@/lib/elevated';

export function App() {
  return (
    <main className="flex min-h-screen bg-background px-6 text-foreground">
      <Elevated
        className="m-auto w-full max-w-xl rounded-xl px-6 py-8 sm:px-8 sm:py-10"
        offset={1}
        shadowLevel={2}
      >
        <Badge color="gray" variant="dot">
          Base UI renderer
        </Badge>
        <h1 className="mt-5 text-display font-semibold tracking-tight">StashBase</h1>
        <p className="mt-3 max-w-md text-body leading-relaxed text-muted-foreground">
          The replacement renderer now uses Fluid Functionalism for its components, motion,
          surfaces, typography, shape, density, and icon language.
        </p>
      </Elevated>
    </main>
  );
}

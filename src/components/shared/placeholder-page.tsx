import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-sysde-border bg-sysde-bg">
            <p className="text-sm text-sysde-mid">Este módulo estará disponible en una próxima fase.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

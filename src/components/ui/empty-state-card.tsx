import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Inbox } from 'lucide-react';

interface EmptyStateCardProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}

export function EmptyStateCard({
  title = 'No Data Available',
  message = 'Data will appear here once available.',
  icon,
}: EmptyStateCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] flex flex-col items-center justify-center text-gray-400 gap-3">
          {icon || <Inbox className="h-8 w-8 text-gray-300" />}
          <p className="text-[13px] text-center max-w-[260px]">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

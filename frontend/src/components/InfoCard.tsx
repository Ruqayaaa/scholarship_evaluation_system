// A reusable card component for displaying informational messages, warnings, errors, or success messages 
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

/* (FigmaMake, 2025) */

/* This component needs:
- a type (info, success, warning, error) that determines the styling and icon
- a title (optional)
- the message content
- an optional className 
*/
interface InfoCardProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function InfoCard({ type = 'info', title, children, className = '' }: InfoCardProps) {
  const styles = {
    info: {
      container: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-600',
      title: 'text-blue-900',
      Icon: Info
    },
    success: {
      container: 'bg-green-50 border-green-200',
      icon: 'text-green-600',
      title: 'text-green-900',
      Icon: CheckCircle
    },
    warning: {
      container: 'bg-orange-50 border-orange-200',
      icon: 'text-orange-600',
      title: 'text-orange-900',
      Icon: AlertTriangle
    },
    error: {
      container: 'bg-red-50 border-red-200',
      icon: 'text-red-600',
      title: 'text-red-900',
      Icon: AlertCircle
    }
  };

  const style = styles[type];
  const Icon = style.Icon;

  return (
    <div className={`border rounded-xl p-5 ${style.container} ${className}`}>
      <div className="flex gap-4">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${style.icon}`} />
        <div className="flex-1">
          {title && (
            <h4 className={`mb-2 ${style.title}`}>{title}</h4>
          )}
          <div className="text-gray-700">{children}</div>
        </div>
      </div>
    </div>
  );
}

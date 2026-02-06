// src/components/layout/AppHeader.tsx

"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface AppHeaderProps {
  // Title and subtitle
  title: string;
  subtitle?: string;
  
  // Back button
  showBackButton?: boolean;
  backUrl?: string;
  onBack?: () => void;
  
  // Right side actions - render your own buttons
  actions?: React.ReactNode;
}

export default function AppHeader({
  title,
  subtitle,
  showBackButton = false,
  backUrl,
  onBack,
  actions,
}: AppHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backUrl) {
      router.push(backUrl);
    } else {
      router.back();
    }
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      {/* Left side - Back button and title */}
      <div className="flex items-center gap-4 min-w-0">
        {showBackButton && (
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
        )}
        {(title || subtitle) && (
          <div className="min-w-0">
            {title && (
              <h1 className="font-semibold text-gray-900 truncate">{title}</h1>
            )}
            {subtitle && (
              <p className="text-sm text-gray-500 truncate">{subtitle}</p>
            )}
          </div>
        )}
      </div>

      {/* Right side - Custom actions */}
      {actions && (
        <div className="flex items-center gap-3 flex-shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
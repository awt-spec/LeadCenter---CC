'use client';

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-sysde-gray group-[.toaster]:border-sysde-border group-[.toaster]:shadow-sm',
          description: 'group-[.toast]:text-sysde-mid',
          actionButton:
            'group-[.toast]:bg-sysde-red group-[.toast]:text-white',
          cancelButton:
            'group-[.toast]:bg-sysde-bg group-[.toast]:text-sysde-gray',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

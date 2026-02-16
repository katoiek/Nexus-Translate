import React, { useState } from 'react';
import { Button } from './ui/button';
import { X, LayoutTemplate } from 'lucide-react';

interface CloseConfirmationDialogProps {
    onClose: () => void; // Just close dialog
    onConfirm: (action: 'quit' | 'minimize', remember: boolean) => void;
}

export function CloseConfirmationDialog({ onClose, onConfirm }: CloseConfirmationDialogProps) {
    const [remember, setRemember] = useState(false);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                    <X className="size-5" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                    <div className="size-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <LayoutTemplate className="size-6 text-blue-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Application Closing</h2>
                </div>

                <p className="text-slate-300 mb-6 leading-relaxed">
                    Do you want to quit the application? <br />
                    Running in the background allows you to use the shortcuts quickly from any app.
                </p>

                <div className="flex items-center gap-2 mb-6 cursor-pointer" onClick={() => setRemember(!remember)}>
                    <div className={`size-5 rounded border border-slate-600 flex items-center justify-center transition-colors ${remember ? 'bg-blue-600 border-blue-600' : 'bg-transparent'}`}>
                        {remember && <X className="size-3 text-white rotate-45" style={{ transform: 'rotate(0deg)' }} />}
                        {/* Actually X rotate 45 is not check, use Check or just a square fill */}
                        {remember && <div className="size-2.5 bg-white rounded-sm" />}
                    </div>
                    <label className="text-sm text-slate-400 select-none cursor-pointer">Remember my choice (Available in Settings)</label>
                </div>

                <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => onConfirm('quit', remember)} className="hover:bg-red-500/10 hover:text-red-400 text-slate-400">
                        Quit
                    </Button>
                    <Button onClick={() => onConfirm('minimize', remember)} className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20">
                        Run in Background
                    </Button>
                </div>
            </div>
        </div>
    );
}

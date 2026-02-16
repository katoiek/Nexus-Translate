import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, Save, Key, ShieldCheck, Sparkles } from 'lucide-react';

interface SettingsViewProps {
    onBack: () => void;
}

export function SettingsView({ onBack }: SettingsViewProps) {
    const [openAIKey, setOpenAIKey] = useState('');
    const [anthropicKey, setAnthropicKey] = useState('');
    const [geminiKey, setGeminiKey] = useState('');
    const [savedMessage, setSavedMessage] = useState('');

    useEffect(() => {
        setOpenAIKey(localStorage.getItem('openai_api_key') || '');
        setAnthropicKey(localStorage.getItem('anthropic_api_key') || '');
        setGeminiKey(localStorage.getItem('gemini_api_key') || '');
    }, []);

    const handleSave = () => {
        localStorage.setItem('openai_api_key', openAIKey);
        localStorage.setItem('anthropic_api_key', anthropicKey);
        localStorage.setItem('gemini_api_key', geminiKey);

        setSavedMessage('Settings saved');
        setTimeout(() => setSavedMessage(''), 3000);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 font-display animate-fade-in relative z-10">
            <div className="w-full max-w-lg">
                <Button
                    variant="ghost"
                    onClick={onBack}
                    className="mb-6 text-slate-400 hover:text-white hover:bg-white/10 -ml-2 rounded-full px-4 group"
                >
                    <ArrowLeft className="mr-2 size-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Translation
                </Button>

                <div className="glass rounded-3xl p-8 border border-white/5 shadow-2xl relative overflow-hidden">
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 right-0 p-12 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none" />
                    <div className="absolute bottom-0 left-0 p-12 bg-violet-500/10 blur-[60px] rounded-full pointer-events-none" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="size-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center shadow-lg">
                                <Key className="size-6 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">API Configuration</h2>
                                <p className="text-sm text-slate-400">Manage your LLM provider keys</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2 group">
                                <Label htmlFor="openai" className="text-slate-300 text-xs font-medium uppercase tracking-wide ml-1">OpenAI API Key</Label>
                                <div className="relative">
                                    <Input
                                        id="openai"
                                        type="password"
                                        placeholder="sk-..."
                                        className="bg-slate-900/50 border-white/10 text-slate-100 placeholder:text-slate-600 focus:border-blue-500/50 focus:bg-slate-900/80 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300 h-11 rounded-xl pl-10"
                                        value={openAIKey}
                                        onChange={(e) => setOpenAIKey(e.target.value)}
                                    />
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                        <ShieldCheck className="size-4" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 group">
                                <Label htmlFor="anthropic" className="text-slate-300 text-xs font-medium uppercase tracking-wide ml-1">Anthropic API Key</Label>
                                <div className="relative">
                                    <Input
                                        id="anthropic"
                                        type="password"
                                        placeholder="sk-ant-..."
                                        className="bg-slate-900/50 border-white/10 text-slate-100 placeholder:text-slate-600 focus:border-violet-500/50 focus:bg-slate-900/80 focus:ring-4 focus:ring-violet-500/10 transition-all duration-300 h-11 rounded-xl pl-10"
                                        value={anthropicKey}
                                        onChange={(e) => setAnthropicKey(e.target.value)}
                                    />
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                        <ShieldCheck className="size-4" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 group">
                                <Label htmlFor="gemini" className="text-slate-300 text-xs font-medium uppercase tracking-wide ml-1">Google Gemini API Key</Label>
                                <div className="relative">
                                    <Input
                                        id="gemini"
                                        type="password"
                                        placeholder="AIza..."
                                        className="bg-slate-900/50 border-white/10 text-slate-100 placeholder:text-slate-600 focus:border-teal-500/50 focus:bg-slate-900/80 focus:ring-4 focus:ring-teal-500/10 transition-all duration-300 h-11 rounded-xl pl-10"
                                        value={geminiKey}
                                        onChange={(e) => setGeminiKey(e.target.value)}
                                    />
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                        <Sparkles className="size-4" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                            <span className={`text-sm font-medium text-green-400 transition-opacity duration-300 ${savedMessage ? 'opacity-100' : 'opacity-0'}`}>
                                {savedMessage}
                            </span>
                            <Button
                                className="bg-white text-slate-900 hover:bg-slate-200 hover:scale-105 active:scale-95 transition-all font-semibold rounded-full px-8 shadow-lg shadow-white/5"
                                onClick={handleSave}
                            >
                                <Save className="mr-2 h-4 w-4" />
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

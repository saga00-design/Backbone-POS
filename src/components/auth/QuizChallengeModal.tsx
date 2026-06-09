import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePOSStore } from '../../app/store';
import { Brain, CheckCircle2, XCircle, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { db } from '../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { POS_CONFIG } from '../../app/config';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface QuizData {
  dishName: string;
  questions: QuizQuestion[];
}

export const QuizChallengeModal: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { menuItems, currentStaff } = usePOSStore();
  const [quiz, setQuiz] = React.useState<QuizData | null>(null);
  const [currentStep, setCurrentStep] = React.useState<-1 | number>(-1); // -1 is loading/intro
  const [answers, setAnswers] = React.useState<{ question: string; isCorrect: boolean; selectedOption: string }[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const generateQuiz = async () => {
      try {
        // Pick a random menu item that has a description
        const itemsWithDesc = menuItems.filter(item => item.description && item.description.length > 20);
        const item = itemsWithDesc[Math.floor(Math.random() * itemsWithDesc.length)] || menuItems[Math.floor(Math.random() * menuItems.length)];
        
        // Only send necessary fields to reduce payload size
        const sanitizedItem = {
          name: item.name,
          description: item.description,
          categoryId: item.categoryId
        };

        const response = await fetch('/api/quiz/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ menuItem: sanitizedItem })
        });

        if (!response.ok) throw new Error('Failed to generate quiz');
        const data = await response.json();
        setQuiz(data);
        setIsLoading(false);
        setCurrentStep(0);
      } catch (err) {
        console.error('Quiz Error:', err);
        setError('Knowledge hub is currently offline. You can proceed to the floor.');
        setIsLoading(false);
      }
    };

    generateQuiz();
  }, [menuItems]);

  const handleAnswer = (optionIndex: number) => {
    if (!quiz || currentStep < 0 || currentStep >= quiz.questions.length) return;

    const question = quiz.questions[currentStep];
    const isCorrect = optionIndex === question.correctIndex;
    
    const newAnswers = [...answers, {
      question: question.question,
      isCorrect,
      selectedOption: question.options[optionIndex]
    }];
    setAnswers(newAnswers);

    if (currentStep < quiz.questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Quiz Finished
      saveResults(newAnswers);
      setCurrentStep(quiz.questions.length);
    }
  };

  const saveResults = async (finalAnswers: typeof answers) => {
    if (!currentStaff || !quiz) return;
    
    const score = finalAnswers.filter(a => a.isCorrect).length;
    
    try {
      await addDoc(collection(db, 'quizSubmissions'), {
        staffId: currentStaff.id,
        dishName: quiz.dishName,
        score,
        totalQuestions: quiz.questions.length,
        completedAt: Date.now(),
        locationId: POS_CONFIG.LOCATION_ID,
        answers: finalAnswers
      });
    } catch (err) {
      console.error('Failed to save quiz results:', err);
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-[110] bg-black/90 flex items-center justify-center p-8">
        <div className="bg-bg-card border border-white/10 p-8 rounded-3xl text-center max-w-md">
          <p className="text-white mb-6 font-bold">{error}</p>
          <button onClick={onComplete} className="px-8 py-4 bg-brand-primary text-white rounded-2xl font-black uppercase tracking-widest">
            Continue to Floor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="relative">
              <Sparkles className="w-16 h-16 text-brand-primary animate-pulse" />
              <Loader2 className="w-16 h-16 text-white/20 absolute inset-0 animate-spin" />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Generating Knowledge Challenge</h3>
              <p className="text-text-muted text-xs font-black uppercase tracking-[0.2em]">Consulting the Culinary Brain...</p>
            </div>
          </motion.div>
        ) : quiz && currentStep >= 0 && currentStep < quiz.questions.length ? (
          <motion.div 
            key="question"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-2xl bg-bg-card border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
          >
            <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-brand-primary/20 rounded-xl flex items-center justify-center text-brand-primary border border-brand-primary/30">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-text-muted text-[10px] font-black uppercase tracking-widest leading-none mb-1">Knowledge Challenge</h4>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">{quiz.dishName}</h2>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest">Question</span>
                <p className="text-2xl font-black text-white">{currentStep + 1} <span className="text-text-muted text-sm">/ {quiz.questions.length}</span></p>
              </div>
            </div>

            <div className="p-8 space-y-8">
              <h3 className="text-2xl font-black text-white leading-tight uppercase italic">{quiz.questions[currentStep].question}</h3>
              
              <div className="grid grid-cols-1 gap-3">
                {quiz.questions[currentStep].options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    className="group flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-2xl text-left hover:bg-brand-primary/10 hover:border-brand-primary/30 transition-all active:scale-[0.98]"
                  >
                    <span className="text-lg font-bold text-white/80 group-hover:text-white uppercase tracking-tight">{option}</span>
                    <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-brand-primary transition-colors" />
                  </button>
                ))}
              </div>
            </div>

            <div className="px-8 pb-8">
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-brand-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep + 1) / quiz.questions.length) * 100}%` }}
                />
              </div>
            </div>
          </motion.div>
        ) : quiz && currentStep === quiz.questions.length ? (
          <motion.div 
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-bg-card border border-white/10 rounded-[2.5rem] p-12 text-center"
          >
            <div className="inline-flex w-24 h-24 bg-brand-primary/20 rounded-3xl items-center justify-center text-brand-primary border border-brand-primary/30 mb-8">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            
            <h2 className="text-4xl font-black text-white uppercase tracking-tight mb-2">Challenge Complete</h2>
            <p className="text-text-muted text-sm font-black uppercase tracking-widest mb-12">Knowledge is Power. Upselling is the Goal.</p>
            
            <div className="grid grid-cols-2 gap-6 mb-12">
              <div className="bg-white/5 rounded-3xl p-8 border border-white/5">
                <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-2 block">Your Score</span>
                <p className="text-5xl font-black text-white">{answers.filter(a => a.isCorrect).length}<span className="text-text-muted text-xl">/5</span></p>
              </div>
              <div className="bg-white/5 rounded-3xl p-8 border border-white/5">
                <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-2 block">Accuracy</span>
                <p className="text-5xl font-black text-emerald-500">{Math.round((answers.filter(a => a.isCorrect).length / 5) * 100)}%</p>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={onComplete}
                className="w-full py-6 bg-brand-primary hover:bg-brand-primary-light text-white rounded-2xl text-lg font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-primary/20"
              >
                Enter the Floor
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

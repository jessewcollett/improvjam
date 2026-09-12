import { Library, Dices, Wrench, ListTodo, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

const items = [
  { id: 'library', label: 'Library', icon: Library },
  { id: 'generator', label: 'Generator', icon: Dices },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'mysets', label: 'Sets', icon: ListTodo },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function BottomNav({ activeRoute, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 w-full bg-[#1A1A1A]/95 backdrop-blur-md border-t border-gray-800 pb-safe z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      <div className="flex justify-around items-center px-1 py-1.5 max-w-md mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center justify-center w-full py-1.5 relative rounded-xl transition-colors min-h-12 ${
                isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNavTab"
                  className="absolute inset-0 bg-gray-800 rounded-xl"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  style={{ zIndex: -1 }}
                />
              )}
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-blue-400 scale-110' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[9px] tracking-wide ${isActive ? 'font-bold text-gray-200' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

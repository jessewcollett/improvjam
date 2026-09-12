export default function ActionDock({ children }) {
  return (
    <div className="md:hidden shrink-0 px-4 pt-3 border-t border-gray-800 bg-stage/95 backdrop-blur-md pb-[calc(4.5rem+env(safe-area-inset-bottom,16px))] z-40">
      {children}
    </div>
  );
}

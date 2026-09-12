export default function ActionDock({ children }) {
  return (
    <div className="md:hidden shrink-0 px-4 pt-3 border-t border-gray-800 bg-stage/95 backdrop-blur-md pb-nav z-40">
      {children}
    </div>
  );
}

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SearchModal from "@/components/SearchModal";
import SitePresence from "@/components/SitePresence";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SitePresence />
      <Header />
      <main className="flex-1 w-full pb-10">{children}</main>
      <Footer />
      <SearchModal />
    </>
  );
}

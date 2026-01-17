import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Values from './components/Values';
import HowItWorks from './components/HowItWorks';
import Milestones from './components/Milestones';
import Download from './components/Download';
import Docs from './components/Docs';
import About from './components/About';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Values />
        <Milestones />
        <HowItWorks />
        <Download />
        <Docs />
        <About />
      </main>
      <Footer />
    </div>
  );
}

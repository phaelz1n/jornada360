import { RealPendenciasSection } from '../components/he/RealPendenciasSection';

export default function Pendencias() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pendências</h1>
          <p className="page-subtitle">Somente o que exige decisão humana</p>
        </div>
      </div>

      <RealPendenciasSection />
    </>
  );
}

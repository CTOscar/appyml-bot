// Informes · Combustible y velocidad: página propia (#/informes). El módulo vive en fleet/Informes.jsx.
import { Informes as Modulo } from '../fleet/Informes.jsx';
import { PageHeader } from '../ui/page.jsx';

export function Informes() {
  return (
    <div>
      <PageHeader title="Informes de combustible" subtitle="Consumo, cargas, descargas y velocidad por tractor y periodo, con gráficas y exportación a CSV." />
      <Modulo />
    </div>
  );
}

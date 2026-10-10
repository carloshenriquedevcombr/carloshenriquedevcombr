// Componentes interativos da placa. Posições em unidades da cena
// (a PCB mede 4 x 2.6 e fica centrada na origem, com o topo em y = 0.04).

export type PartId = "mcu" | "flash" | "uart" | "usb" | "antenna";

export interface PartInfo {
  id: PartId;
  label: string;
  tag: string;
  description: string;
  /** Deslocamento em y quando a placa é "desmontada" */
  explodeY: number;
  href?: string;
}

export const PARTS: PartInfo[] = [
  {
    id: "mcu",
    label: "Microcontrolador ESP32",
    tag: "MCU",
    description:
      "O cérebro do dispositivo: Wi-Fi, Bluetooth e GPIOs. No laboratório é o ponto de partida para levar sensores e atuadores até uma API.",
    explodeY: 0.9,
    href: "/projects/esp32-telemetria",
  },
  {
    id: "flash",
    label: "Memória Flash SPI",
    tag: "SPI",
    description:
      "Onde mora o firmware. Ler este chip com um programador SPI e analisar o dump revela configurações, chaves e credenciais esquecidas pelo fabricante.",
    explodeY: 1.15,
  },
  {
    id: "uart",
    label: "Header UART",
    tag: "UART",
    description:
      "Porta serial de debug que muitas vezes sai de fábrica habilitada. Com um adaptador USB-TTL e o baud rate certo, dá para acompanhar o boot e às vezes chegar a um shell.",
    explodeY: 0.7,
  },
  {
    id: "usb",
    label: "Conector USB",
    tag: "USB",
    description:
      "Alimentação e gravação de firmware. Também é superfície de ataque: dispositivos que se passam por teclado (HID) executam comandos em segundos.",
    explodeY: 0.55,
  },
  {
    id: "antenna",
    label: "Antena PCB 2.4 GHz",
    tag: "RF",
    description:
      "Por onde Wi-Fi e BLE saem para o mundo — e onde começa a análise de tráfego sem fio, do sniffing à detecção de dispositivos não autorizados.",
    explodeY: 0.9,
  },
];

export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p])) as Record<
  PartId,
  PartInfo
>;

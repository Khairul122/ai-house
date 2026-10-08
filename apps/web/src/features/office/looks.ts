export type Accessory =
  | "hardhat"
  | "glasses"
  | "hood"
  | "beret"
  | "headphones"
  | "tie"
  | "cap"
  | "bun"
  | "visor"
  | "scarf";

export interface Look {
  name: string; // nama karakter
  traits: string[]; // sifat, tampil di kartu karakter
  short: string; // nama di papan pintu
  shirt: string;
  hair: string;
  skin: string;
  accent: string; // satu warna khas divisi, hanya di aksesori dan papan pintu
  accessory: Accessory;
}

export const LOOKS: Record<string, Look> = {
  pm: { name: "Raka Pratama", traits: ["Terorganisir", "Pecinta kopi", "Pemimpin rapat"], short: "PM", shirt: "#3F4A5A", hair: "#2B1E16", skin: "#E2B48C", accent: "#B4410F", accessory: "tie" },
  "software-development": { name: "Dimas Arya", traits: ["Fokus tinggi", "Suka musik lo-fi", "Pemburu bug"], short: "Dev", shirt: "#4A5A3F", hair: "#1C1A17", skin: "#C98E64", accent: "#5B7F3A", accessory: "headphones" },
  "ui-ux-design": { name: "Maria Clara", traits: ["Perfeksionis warna", "Kreatif", "Kolektor sketsa"], short: "Desain", shirt: "#EADFCB", hair: "#7A3B1E", skin: "#F0C9A4", accent: "#A8452E", accessory: "beret" },
  devops: { name: "Fajar Nugraha", traits: ["Tenang di bawah tekanan", "Bangun pagi", "Penjaga server"], short: "DevOps", shirt: "#5B4A3A", hair: "#3A2A1C", skin: "#B57C55", accent: "#D49A1F", accessory: "hardhat" },
  "qa-testing": { name: "Grace Natalia", traits: ["Teliti", "Kritis", "Suka teka-teki"], short: "QA", shirt: "#6B7B83", hair: "#4A3826", skin: "#E8BE98", accent: "#2F6F7A", accessory: "glasses" },
  cybersecurity: { name: "Hendra Gunawan", traits: ["Waspada", "Pendiam", "Burung malam"], short: "Cyber", shirt: "#2E2F33", hair: "#121212", skin: "#D6A47C", accent: "#4F5D75", accessory: "hood" },
  "data-analyst": { name: "Debora Wijaya", traits: ["Logis", "Suka grafik", "Pembaca buku"], short: "Data", shirt: "#7A5C46", hair: "#5A3A22", skin: "#F2D0B0", accent: "#3D6B8C", accessory: "bun" },
  "content-creator": { name: "Made Ayu Lestari", traits: ["Ekspresif", "Suka foto", "Ramah"], short: "Konten", shirt: "#C9A27A", hair: "#2A1A12", skin: "#9C6B48", accent: "#B85C38", accessory: "cap" },
  "research-content": { name: "Liana Setiawan", traits: ["Ingin tahu", "Kutu buku", "Sabar"], short: "Riset", shirt: "#556B5E", hair: "#8C8C88", skin: "#EBC7A2", accent: "#6B5B95", accessory: "scarf" },
  "infrastructure-network": { name: "Bayu Saputra", traits: ["Praktis", "Suka olahraga", "Teknisi andal"], short: "Infra", shirt: "#45505C", hair: "#2B2B2B", skin: "#C48A60", accent: "#7A8B3F", accessory: "visor" }
};

export const lookOf = (id: string): Look =>
  LOOKS[id] ?? { name: id, traits: [], short: id, shirt: "#777", hair: "#333", skin: "#D9A57E", accent: "#888", accessory: "cap" };

// Palet material kantor.
export const MAT = {
  concrete: "#CFC8BA",
  corridor: "#BDB3A2",
  wood: "#C49A6C",
  woodDark: "#8A6442",
  wall: "#EFE8DA",
  wallTop: "#D9CFBC",
  metal: "#5E6266",
  screenOff: "#22242A",
  plant: "#5F7F4A",
  pot: "#A65E3A",
  // status (hanya tiga warna yang punya arti)
  working: "#D7E6F2",
  waiting: "#E0A030",
  failed: "#C0392B",
  done: "#3E9B5F"
};

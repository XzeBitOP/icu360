export interface BookLink {
  label: string;
  href: string;
}

export interface Book {
  id: string;
  title: string;
  emoji: string;
  links: BookLink[];
}

export const BOOKS: Book[] = [
  {
    id: "icu-essentials",
    title: "ICU Essentials: 50 Common Case Presentations",
    emoji: "📘",
    links: [
      { label: "Paperback (Pothi)", href: "https://store.pothi.com/book/dr-kenil-shah-icu-essentials-50-common-case-presentations/" },
      { label: "Audiobook (Google Play)", href: "https://play.google.com/store/audiobooks/details?id=AQAAAEAqIFhgYM" },
      { label: "eBook (Pothi)", href: "https://store.pothi.com/book/ebook-dr-kenil-shah-icu-essentials/" },
      { label: "Amazon", href: "https://amzn.in/d/95JsyRX" },
      { label: "Google Books", href: "https://play.google.com/store/books/details?id=FldpEQAAQBAJ" },
    ],
  },
  {
    id: "interpretation-handbook",
    title: "The Ultimate Interpretation Handbook",
    emoji: "📕",
    links: [
      { label: "eBook (Pothi)", href: "https://store.pothi.com/book/ebook-dr-kenil-shah-ultimate-interpretation-handbook/" },
      { label: "Amazon", href: "https://kdp.amazon.com/amazon-dp-action/in/dualbookshelf.marketplacelink/B0FG51YQ52" },
      { label: "Google Books", href: "https://play.google.com/store/books/details?id=7mpsEQAAQBAJ" },
    ],
  },
  {
    id: "say-it-simple",
    title: "Say It Simple",
    emoji: "📗",
    links: [
      { label: "Amazon", href: "https://kdp.amazon.com/amazon-dp-action/in/dualbookshelf.marketplacelink/B0FFMSJZP2" },
      { label: "Google Books", href: "https://play.google.com/store/books/details?id=unRpEQAAQBAJ" },
    ],
  },
];

import { Injectable } from '@nestjs/common';
import { ResumeSourceType } from '@prisma/client';

type StructuredEntry = {
  headline: string;
  period?: string;
  highlights: string[];
};

type StructuredResume = {
  basics: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    summary?: string;
  };
  skills: string[];
  experiences: StructuredEntry[];
  projects: StructuredEntry[];
  education: StructuredEntry[];
  rawSections: Record<string, string[]>;
};

type SectionKey = 'header' | 'summary' | 'skills' | 'experience' | 'projects' | 'education';

const SECTION_RULES: Array<{ key: SectionKey; patterns: RegExp[] }> = [
  { key: 'summary', patterns: [/^summary$/i, /^profile$/i, /^简介$/, /^自我评价$/, /^个人简介$/] },
  { key: 'skills', patterns: [/^skills?$/i, /^技术栈$/, /^专业技能$/, /^技能$/, /^能力标签$/] },
  { key: 'experience', patterns: [/^experience$/i, /^employment$/i, /^工作经历$/, /^工作经验$/] },
  { key: 'projects', patterns: [/^projects?$/i, /^项目经历$/, /^项目经验$/, /^项目$/] },
  { key: 'education', patterns: [/^education$/i, /^教育经历$/, /^教育背景$/, /^学历信息$/] },
];

@Injectable()
export class ResumeParserService {
  private readonly parserVersion = 'resume-parser-v1';

  parse(rawText: string, sourceType: ResumeSourceType): { parserVersion: string; parsedData: StructuredResume } {
    const normalized = this.normalizeContent(rawText, sourceType);
    const sections = this.splitSections(normalized);
    const header = [...sections.header];
    const summaryLines = [...sections.summary];
    const basics = this.extractBasics(header, summaryLines);

    const parsedData: StructuredResume = {
      basics,
      skills: this.extractSkills(sections.skills),
      experiences: this.extractEntries(sections.experience),
      projects: this.extractEntries(sections.projects),
      education: this.extractEntries(sections.education),
      rawSections: {
        header: sections.header,
        summary: sections.summary,
        skills: sections.skills,
        experience: sections.experience,
        projects: sections.projects,
        education: sections.education,
      },
    };

    return {
      parserVersion: this.parserVersion,
      parsedData,
    };
  }

  private normalizeContent(rawText: string, sourceType: ResumeSourceType) {
    const normalizedLineBreak = rawText.replace(/\r\n?/g, '\n').trim();
    if (sourceType !== ResumeSourceType.MARKDOWN) {
      return normalizedLineBreak;
    }

    return normalizedLineBreak
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/[*_~]/g, '');
  }

  private splitSections(content: string): Record<SectionKey, string[]> {
    const buckets: Record<SectionKey, string[]> = {
      header: [],
      summary: [],
      skills: [],
      experience: [],
      projects: [],
      education: [],
    };

    let current: SectionKey = 'header';
    for (const raw of content.split('\n')) {
      const cleaned = raw.trim();
      if (!cleaned) {
        continue;
      }

      const next = this.detectSection(cleaned);
      if (next) {
        current = next;
        continue;
      }

      buckets[current].push(this.stripMarkdownPrefix(cleaned));
    }

    return buckets;
  }

  private stripMarkdownPrefix(line: string) {
    return line.replace(/^#{1,6}\s*/, '').replace(/^[-*•]\s+/, '').trim();
  }

  private detectSection(line: string): SectionKey | null {
    const normalized = this.stripMarkdownPrefix(line).replace(/[:：]$/, '').trim();
    if (normalized.length > 24) {
      return null;
    }

    for (const rule of SECTION_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(normalized))) {
        return rule.key;
      }
    }
    return null;
  }

  private extractBasics(headerLines: string[], summaryLines: string[]) {
    const merged = [...headerLines, ...summaryLines];
    const text = merged.join('\n');

    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    const phone = text.match(/(?:\+?\d{1,3}[-\s]?)?(?:1[3-9]\d{9}|\d{3,4}[-\s]?\d{7,8})/)?.[0];

    const name = headerLines.find((line) => {
      const noSpace = line.replace(/\s+/g, '');
      const maybeName = noSpace.length >= 2 && noSpace.length <= 30;
      const isContactLike = /@|\d{7,}/.test(line);
      return maybeName && !isContactLike;
    });

    const location = merged.find((line) =>
      /北京|上海|广州|深圳|杭州|成都|南京|武汉|苏州|remote|hybrid|onsite|市|省|区/i.test(line),
    );

    return {
      name,
      email,
      phone,
      location,
      summary: summaryLines.slice(0, 4).join(' '),
    };
  }

  private extractSkills(lines: string[]) {
    const tokenSet = new Set<string>();
    for (const line of lines) {
      const cleaned = line.replace(/^[-*•]\s+/, '');
      cleaned
        .split(/[，,、/|｜·；;]+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2)
        .forEach((item) => tokenSet.add(item));
    }
    return [...tokenSet].slice(0, 60);
  }

  private extractEntries(lines: string[]): StructuredEntry[] {
    const entries: StructuredEntry[] = [];
    let current: StructuredEntry | null = null;

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        continue;
      }

      const bulletLike = /^[-*•]/.test(raw);
      if (bulletLike) {
        if (!current) {
          current = { headline: '未命名条目', highlights: [] };
        }
        current.highlights.push(line.replace(/^[-*•]\s*/, ''));
        continue;
      }

      const shouldStartNew = this.looksLikeNewEntry(line);
      if (shouldStartNew && current) {
        entries.push(current);
        current = null;
      }

      if (!current) {
        const period = line.match(/(20\d{2}[./-]?\d{0,2}\s*(?:-|~|至|to)\s*(?:20\d{2}[./-]?\d{0,2}|至今|present))/i)?.[0];
        current = {
          headline: line,
          period: period ?? undefined,
          highlights: [],
        };
      } else {
        current.highlights.push(line);
      }
    }

    if (current) {
      entries.push(current);
    }

    return entries.slice(0, 30);
  }

  private looksLikeNewEntry(line: string) {
    if (/[|｜]/.test(line)) {
      return true;
    }
    if (/^(20\d{2}[./-]?\d{0,2}).*(至今|present|20\d{2}[./-]?\d{0,2})/i.test(line)) {
      return true;
    }
    if (/(有限公司|Inc\.?|Ltd\.?|大学|University|科技|信息|系统)/i.test(line) && line.length <= 80) {
      return true;
    }
    return false;
  }
}


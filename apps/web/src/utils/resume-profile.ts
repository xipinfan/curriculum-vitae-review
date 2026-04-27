import type { StructuredResume } from '@/types/resume';

type ProfileFallbacks = {
  role?: string;
  techStack?: string;
  level?: string;
  domain?: string;
};

function pickRole(parsedData: StructuredResume, resumeContent: string, fallbackRole?: string) {
  const headline = parsedData.rawSections.header.join(' ');
  const source = `${headline}\n${resumeContent}`.toLowerCase();

  if (/front[\s-]?end|前端/.test(source)) return '前端开发工程师';
  if (/full[\s-]?stack|全栈/.test(source)) return '全栈开发工程师';
  if (/data|算法|machine learning|ai|llm|模型/.test(source)) return 'AI / 数据工程师';
  if (/product|产品/.test(source)) return '产品经理';
  if (/test|qa|测试/.test(source)) return '测试开发工程师';
  if (/devops|sre|运维/.test(source)) return 'DevOps / SRE 工程师';
  if (/backend|back-end|后端|java|go|golang|nestjs|node/.test(source)) return '后端开发工程师';

  return fallbackRole?.trim() || '后端开发工程师';
}

function pickLevel(parsedData: StructuredResume, fallbackLevel?: string) {
  const projectCount = parsedData.projects.length + parsedData.experiences.length;
  if (projectCount >= 5) return '资深';
  if (projectCount >= 2) return '中级';
  return fallbackLevel?.trim() || '中级';
}

function pickDomain(resumeContent: string, fallbackDomain?: string) {
  const source = resumeContent.toLowerCase();
  if (/payment|订单|交易|电商/.test(source)) return '电商交易 / 支付链路';
  if (/saas|crm|erp|b 端|b端/.test(source)) return 'B 端系统 / SaaS';
  if (/推荐|广告|增长/.test(source)) return '推荐 / 广告增长';
  if (/风控|合规/.test(source)) return '风控 / 合规';
  if (/infra|平台|中台|基础设施/.test(source)) return '平台工程 / 基础设施';
  return fallbackDomain?.trim() || '通用业务系统';
}

function uniqueTokens(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

export function inferProfileFromResume(parsedData: StructuredResume, resumeContent: string, fallbacks: ProfileFallbacks) {
  const skills = uniqueTokens(
    (parsedData.skills.length > 0 ? parsedData.skills : (fallbacks.techStack ?? '').split(/[，,、/|｜·；;\s]+/)).slice(0, 8),
  );
  const role = pickRole(parsedData, resumeContent, fallbacks.role);
  const level = pickLevel(parsedData, fallbacks.level);
  const domain = pickDomain(resumeContent, fallbacks.domain);
  const confidence = Math.min(
    96,
    Math.max(
      72,
      72 +
        Math.min(10, parsedData.skills.length * 2) +
        Math.min(8, parsedData.projects.length * 2) +
        Math.min(6, parsedData.experiences.length * 2),
    ),
  );

  const evidenceChunks = [
    parsedData.rawSections.header.slice(0, 2).join('，'),
    parsedData.skills.slice(0, 4).join(' / '),
    parsedData.projects[0]?.headline ?? parsedData.experiences[0]?.headline ?? '',
  ].filter(Boolean);

  const reasoning = `简历标题、技能栈和项目经历共同指向“${role}”；已识别 ${skills.length} 个技术关键词，当前项目复杂度更接近“${level}”级别，因此优先推断到“${domain}”。`;

  return {
    role,
    level,
    domain,
    techStackList: skills,
    techStack: skills.join(' / '),
    confidence,
    reasoning,
    evidencePreview: evidenceChunks.join('\n\n'),
  };
}

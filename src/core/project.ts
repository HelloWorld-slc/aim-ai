import path from 'node:path';

export const START = '#region VEXcode Generated Robot Configuration';
export const END = '#endregion VEXcode Generated Robot Configuration';
export const MAX_SOURCE = 120_000;
export interface AimProject { mode: 'Text'; platform: 'AIM'; textLanguage: 'python'; textContent: string; slot: number; [key: string]: unknown }

export function safeChild(root: string, relative: string): string {
  if (!relative || path.isAbsolute(relative)) throw new Error('项目路径必须是相对路径。');
  const target = path.resolve(root, relative);
  const rel = path.relative(path.resolve(root), target);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error('文件不在所选项目中。');
  return target;
}

export function projectName(value: string): string {
  const name = value.trim();
  if (!/^[\p{L}\p{N}_ -]{1,60}$/u.test(name) || /[. ]$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) {
    throw new Error('名称请使用 1–60 个中英文、数字、空格、下划线或短横线，不能使用 Windows 保留名。');
  }
  return name;
}

export function parseAimProject(input: string): AimProject {
  if (input.length > 2_000_000) throw new Error('项目超过 2 MB，当前版本只支持单文件文本项目。');
  if (input.startsWith('PK')) throw new Error('当前版本不支持带资源的压缩项目，请从 VEXcode AIM 导出普通 Python 项目。');
  const data = JSON.parse(input.replace(/^\uFEFF/, '')) as AimProject;
  if (!data || data.platform !== 'AIM' || data.mode !== 'Text' || data.textLanguage !== 'python' || typeof data.textContent !== 'string') {
    throw new Error('需要 VEX AIM 的 Python 文本项目（.aimpython），不能导入 V5、IQ 或积木项目。');
  }
  if (data.textContent.length > MAX_SOURCE) throw new Error('源码过长，请使用课堂单文件项目。');
  if (!Number.isInteger(data.slot) || data.slot < 0 || data.slot > 7) throw new Error('项目槽位格式无效（文件使用 0–7，界面显示 1–8）。');
  // VEXcode AIM 4.67.0 can duplicate adjacent opening comments when regenerating
  // its header. Collapse only that exact comment pattern, without changing code.
  data.textContent = data.textContent.replace(/(?:^#region VEXcode Generated Robot Configuration\r?\n){2,}/gm, START + '\n');
  return data;
}

export function region(source: string): string | undefined {
  const starts = source.split(START).length - 1;
  const ends = source.split(END).length - 1;
  if (!starts && !ends) return undefined;
  if (starts !== 1 || ends !== 1 || source.indexOf(END) < source.indexOf(START)) throw new Error('机器人配置区域标记缺失或重复，请先修复。');
  return source.slice(source.indexOf(START), source.indexOf(END) + END.length);
}

export function preserveRegion(before: string, after: string): void {
  const original = region(before);
  if (original && region(after)?.replace(/\r\n/g, '\n') !== original.replace(/\r\n/g, '\n')) throw new Error('AI 修改了机器人配置区域。请要求它保留该区域后重新生成。');
}

/** Conservative conversion for the standard VS Code AIM template only. */
export function exportSource(source: string): string {
  if (source.length > MAX_SOURCE) throw new Error('源码超过课堂项目大小限制。');
  const normalized = source.replace(/\r\n/g, '\n');
  if (region(normalized)) return normalized;
  const prefix = /^(?:(?:[ \t]*#[^\n]*)?[ \t]*\n)*from vex import \*[ \t]*\n(?:(?:[ \t]*#[^\n]*)?[ \t]*\n)*robot[ \t]*=[ \t]*Robot\(\)[ \t]*(?:\n|$)/;
  const match = normalized.match(prefix);
  if (!match) throw new Error('导出需要标准 AIM 模板或完整的机器人配置区域；请保留 from vex import * 和 robot = Robot()。');
  return `${START}\n${match[0].trimEnd()}\n${END}\n${normalized.slice(match[0].length)}`;
}

export function serializeProject(source: string, slot: number, original?: AimProject): string {
  if (!Number.isInteger(slot) || slot < 1 || slot > 8) throw new Error('请选择 1–8 号槽位。');
  const data = original ? structuredClone(original) : {
    mode: 'Text', textLanguage: 'python', rconfig: [], robotConfig: [], platform: 'AIM',
    sdkVersion: '', appVersion: '', fileFormat: '2.0.0', icon: ''
  };
  // VEXcode AIM project files are zero-based; VS Code project settings are one-based.
  return JSON.stringify({ ...data, mode: 'Text', platform: 'AIM', textLanguage: 'python', slot: slot - 1, textContent: exportSource(source) }, null, 2) + '\n';
}

export const EMPTY_SOURCE = `${START}
from vex import *
robot = Robot()
${END}

# AIM AI: 在这里编写自己的程序。
robot.stop_all_movement()
`;

export const SQUARE_SOURCE = `${START}
from vex import *
robot = Robot()
${END}

# 小范围正方形；距离为毫米，速度为百分比。
SIDE_LENGTH_MM = 100
SPEED = 20
robot.set_move_velocity(SPEED, PERCENT)
robot.set_turn_velocity(SPEED, PERCENT)
wait(1, SECONDS)
for side in range(4):
    robot.move_for(SIDE_LENGTH_MM, 0)
    robot.turn_for(RIGHT, 90)
robot.stop_all_movement()
`;

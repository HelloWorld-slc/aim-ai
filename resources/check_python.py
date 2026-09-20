"""Read JSON on stdin and check AST only. Never import or run student code."""
import ast
import json
import sys


def check(source):
    issues = []
    try:
        tree = ast.parse(source)
    except SyntaxError as err:
        return [{"line": err.lineno or 1, "column": err.offset or 1, "severity": "error", "message": err.msg}]
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            names = [node.module or ""] if isinstance(node, ast.ImportFrom) else [x.name for x in node.names]
            if any(n.split('.')[0] in ('vexcode_vr', 'aim', 'requests', 'openai', 'numpy', 'cv2', 'socket', 'subprocess') for n in names):
                issues.append({"line": node.lineno, "column": 1, "severity": "warning", "message": "该导入可能属于电脑端或其他平台，请核对 AIM 机器人端 MicroPython 支持。"})
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in ('Brain', 'Motor', 'Drivetrain', 'SmartDrive'):
            issues.append({"line": node.lineno, "column": 1, "severity": "warning", "message": "可能混用了 V5/IQ 驱动接口；AIM 通常使用 Robot()。"})
        if isinstance(node, ast.While) and isinstance(node.test, ast.Constant) and node.test.value is True:
            calls = [n for n in ast.walk(node) if isinstance(n, ast.Call)]
            if not any(isinstance(n.func, ast.Name) and n.func.id == 'wait' for n in calls):
                issues.append({"line": node.lineno, "column": 1, "severity": "warning", "message": "持续循环中未发现 wait；请检查让出执行时间和停止条件。"})
    return issues


if __name__ == '__main__':
    sys.stdin.reconfigure(encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')
    data = json.load(sys.stdin)
    print(json.dumps({"issues": check(data['source']), "scope": "Python AST syntax and classroom hints; no robot code executed"}, ensure_ascii=False))

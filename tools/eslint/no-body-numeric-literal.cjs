/**
 * Disallow raw numeric literals where a {@link Body} enum member is meant.
 *
 * Applies outside `packages/core/src` (core owns the enum values). Tests and
 * fixtures are excluded via eslint.config.js ignores.
 */

const BODY_LITERALS = new Set([0, 1, 2, 3, 4, 5, 6, 10, 99]);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Require Body enum instead of numeric body id literals',
        },
        messages: {
            useBodyEnum:
                'Use Body.* from @node-jhora/core instead of numeric body id {{value}}.',
        },
        schema: [],
    },
    create(context) {
        function reportIfBodyLiteral(node) {
            if (node.type !== 'Literal' || typeof node.value !== 'number') return;
            if (!BODY_LITERALS.has(node.value)) return;

            const parent = node.parent;
            if (!parent) return;

            if (parent.type === 'BinaryExpression' && ['===', '==', '!==', '!='].includes(parent.operator)) {
                const other = parent.left === node ? parent.right : parent.left;
                if (other.type === 'MemberExpression' && other.property?.type === 'Identifier' && other.property.name === 'id') {
                    context.report({ node, messageId: 'useBodyEnum', data: { value: String(node.value) } });
                    return;
                }
                if (other.type === 'Identifier' && /planetId|donorId|targetId|lordId|aspectingPlanetId|planetA|planetB|pId|naifBody/i.test(other.name)) {
                    context.report({ node, messageId: 'useBodyEnum', data: { value: String(node.value) } });
                    return;
                }
            }

        }

        return {
            Literal(node) {
                reportIfBodyLiteral(node);
            },
        };
    },
};

import { fromPairs, isArray, map } from 'lodash';

export function makeLookup<T>(
  items: Array<T>,
  key: string
): { [key: string]: T } {
  // Yep, we can't index into item without knowing what it is. True. But we want to.
  // @ts-ignore
  const pairs = map(items, item => [item[key], item]);

  return fromPairs(pairs);
}

export function makeMemberGroupLookup<
  T extends { id: string; members?: string[]; type: string },
>(items: Array<T>): { [key: string]: string[] } {
  return items.reduce(
    (prevObj, currValue) => {
      const { id, members, type } = currValue;
      if (!members?.length || type !== 'group') {
        return prevObj;
      }

      for (const member of members) {
        const groups = prevObj[member];
        if (isArray(groups)) {
          if (!groups.includes(id)) {
            groups.push(id);
          }
        } else {
          prevObj[member] = [id];
        }
      }

      return prevObj;
    },
    {} as { [key: string]: string[] }
  );
}

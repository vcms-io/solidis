const BASE_URL =
  'https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis';

export function fluentEmoji(category: string, name: string, size = 25): string {
  const path = `${category}/${name}.png`.replace(/ /g, '%20');

  return `<img src="${BASE_URL}/${path}?raw=true" alt="${name}" width="${size}" height="${size}" />`;
}

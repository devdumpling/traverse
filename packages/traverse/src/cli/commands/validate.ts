/**
 * Validate command implementation.
 */

import type { ValidateCommand } from '../../types.ts';
import { validateJourney } from '../../journey/index.ts';

export const executeValidate = async (command: ValidateCommand): Promise<number> => {
  console.log(`Validating: ${command.journeyFile}...`);

  const result = await validateJourney(command.journeyFile);

  if (!result.ok) {
    console.error(`Validation failed: ${result.error.message}`);
    return 1;
  }

  console.log(`Valid journey definition`);
  console.log(`  Name: ${result.value.name}`);
  console.log(`  Description: ${result.value.description}`);
  
  return 0;
};

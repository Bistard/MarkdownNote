
export interface ITask<T> {
	(): T; // any functions that returns `T`
}

/**
 * @description Delays for given milliseconds.
 * @param ms Milliseconds.
 */
export async function delayFor(ms: number): Promise<void> {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

/**
 * @description Helper functions for retrying a given task for given retry rounds. 
 * @param task Task function.
 * @param delay Delay ms.
 * @param retries Retry rounds.
 */
export async function retry<T>(task: ITask<Promise<T>>, delay: number, retries: number): Promise<T> {
	let lastError: Error | unknown;

	for (let i = 0; i < retries; i++) {
		
        try {
            // try to finish the task.
			return await task();
		} 
        
        catch (error) {
            // if not, we delay for a while and will retry the task.
			lastError = error;
			await delayFor(delay);
		}

	}

	throw lastError;
}

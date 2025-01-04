function handle(promise, timeout) {

    //Establish a timeout period  
    let timer;
    if (!timeout) timeout = process.env.TIMEOUT; //Set a default timeout period
    if (!timeout) timeout = 30000; //If env is not set, the default to 30 seconds
  
    return Promise.race([
      //return the promise we are after
      promise
        .then(data => ({ success: data, failure: undefined }))
        .catch(error => Promise.resolve({ success: undefined, failure: error })),
      //Return a failue if the timeout is reached
      new Promise((_res, _rej) => timer = setTimeout(_res, timeout, { success: undefined, failure: 'Timeout Error' }))
    ]).finally(() => clearTimeout(timer));
  
  }
  
  module.exports = handle;
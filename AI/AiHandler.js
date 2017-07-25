const client = new ApiAi.ApiAiClient({accessToken: 'be59ea6cae5a4df990e96569177e9053'});
let promise = client.textRequest(longTextRequest);

promise
    .then(handleResponse)
    .catch(heandleError);

function handleResponse(serverResponse) {
        console.log(serverResponse);
}
function heandleError(serverError) {
        console.log(serverError);
}

let promise = client.eventRequest("EVENT_NAME", options);

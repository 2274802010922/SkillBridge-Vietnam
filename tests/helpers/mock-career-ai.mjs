// Test-process preload only. Production never imports this file or enables a fake AI flag.
const original=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
  if(String(input)!=="https://openrouter.ai/api/v1/chat/completions")return original(input,options);
  const request=JSON.parse(String(options.body));
  const value=JSON.parse(request.messages[1].content);
  const source=value.sources[0];
  const draft={claims:[{text:"QA draft based on the selected source",sourceId:source.id,quote:value.target.includes("INVALID_QUOTE_QA")?"invented quote":source.content.slice(0,35)}],gaps:["QA missing evidence"],questions:["QA practice question"]};
  return Response.json({model:"qa/fixture",choices:[{message:{content:JSON.stringify(draft)}}],usage:{prompt_tokens:100,completion_tokens:60}});
};

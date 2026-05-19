module.exports = async function handler(req, res){
  if(req.method !== 'POST'){
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if(!apiKey){
    return res.status(500).json({ error: 'OPENAI_API_KEY mancante sul server' });
  }

  const products = Array.isArray(req.body?.products) ? req.body.products : [];
  const categories = Array.isArray(req.body?.categories) ? req.body.categories : [];
  if(!products.length){
    return res.status(400).json({ error: 'Nessun prodotto ricevuto' });
  }
  if(products.length > 120){
    return res.status(400).json({ error: 'Troppi prodotti in un blocco' });
  }

  const cleanProducts = products.map(product => ({
    barcode: String(product?.barcode || '').slice(0, 80),
    name: String(product?.name || '').slice(0, 180),
    supplier: String(product?.supplier || '').slice(0, 100)
  }));
  const cleanCategories = categories
    .map(category => String(category || '').trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 80);

  const payload = {
    model: process.env.OPENAI_CATEGORIZER_MODEL || 'gpt-4.1-mini',
    input: [
      {
        role: 'system',
        content: 'Sei un assistente per un negozio. Devi assegnare categorie brevi in italiano ai prodotti. Preferisci categorie esistenti quando sono adatte. Se non sei sicuro usa "Da controllare". Rispondi solo con JSON valido nello schema richiesto.'
      },
      {
        role: 'user',
        content: JSON.stringify({
          categories: cleanCategories,
          products: cleanProducts
        })
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'inventory_categories',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  barcode: { type: 'string' },
                  category: { type: 'string' },
                  confidence: { type: 'number' },
                  reason: { type: 'string' }
                },
                required: ['barcode', 'category', 'confidence', 'reason']
              }
            }
          },
          required: ['items']
        }
      }
    },
    max_output_tokens: 10000
  };

  const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await openaiResponse.json().catch(() => null);
  if(!openaiResponse.ok){
    return res.status(openaiResponse.status).json({
      error: data?.error?.message || 'Errore OpenAI'
    });
  }

  const outputText = extractOutputText(data);
  let parsed = null;
  try{
    parsed = JSON.parse(outputText);
  }catch(error){
    return res.status(502).json({ error: 'Risposta ChatGPT non leggibile' });
  }

  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return res.status(200).json({
    items: items.map(item => ({
      barcode: String(item?.barcode || ''),
      category: String(item?.category || 'Da controllare').slice(0, 40),
      confidence: Number(item?.confidence || 0),
      reason: String(item?.reason || '').slice(0, 120)
    }))
  });
};

function extractOutputText(data){
  if(typeof data?.output_text === 'string') return data.output_text;
  const parts = [];
  for(const item of data?.output || []){
    for(const content of item?.content || []){
      if(typeof content?.text === 'string') parts.push(content.text);
      else if(typeof content?.text?.value === 'string') parts.push(content.text.value);
    }
  }
  return parts.join('\n');
}

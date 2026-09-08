app.use(express.json());

app.post("/generate-video",(req,res)=>{

let prompt=req.body.prompt;

res.json({
message:"AI video request received: "+prompt
});

});

require('dotenv').config();
const express=require('express');
const app=express();
const PORT=process.env.PORT||3000;
app.use(express.static('public'));
app.get('/health',(req,res)=>res.json({ok:true}));
app.listen(PORT,'0.0.0.0',()=>console.log('running'));
